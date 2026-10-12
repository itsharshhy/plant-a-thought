-- Plant a Thought: shared gardens, circles, waters, reports and community questions.
--
-- Security model
-- * No accounts. Each device has a random secret; we only ever store sha256(secret).
-- * Every table has RLS enabled and NO policies, and anon/authenticated have no table grants,
--   so the public API key cannot read or write tables directly.
-- * The app talks only to the SECURITY DEFINER functions below, which check limits and ownership.
-- * A garden is reachable only by its unguessable slug (the invite link).

create extension if not exists pgcrypto with schema extensions;

create table public.gardens (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('friends', 'circle')),
  pack text not null default 'everyday' check (char_length(pack) <= 20),
  lang text not null default 'en' check (lang in ('en', 'hi')),
  anonymous boolean not null default false,
  prompt text check (char_length(prompt) <= 200),
  locked boolean not null default false,
  host_hash text not null,
  -- Closing a garden wipes every word in it and makes the link stop working.
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens (id) on delete cascade,
  author_hash text not null,
  author_name text check (char_length(author_name) <= 16),
  word text not null check (char_length(word) between 1 and 280),
  mood text check (mood in ('happy', 'sad', 'angry', 'anxious', 'calm')),
  prompt text check (char_length(prompt) <= 200),
  waters integer not null default 0,
  reports integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index plants_garden_idx on public.plants (garden_id, created_at desc);
create index plants_author_idx on public.plants (garden_id, author_hash);

create table public.waters (
  plant_id uuid not null references public.plants (id) on delete cascade,
  author_hash text not null,
  created_at timestamptz not null default now(),
  primary key (plant_id, author_hash)
);

create table public.reports (
  plant_id uuid not null references public.plants (id) on delete cascade,
  author_hash text not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (plant_id, author_hash)
);

create table public.prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 5 and 200),
  lang text not null default 'en' check (lang in ('en', 'hi')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  author_hash text not null,
  created_at timestamptz not null default now()
);
create index prompt_suggestions_status_idx on public.prompt_suggestions (status, lang);
create index gardens_host_idx on public.gardens (host_hash, created_at);

alter table public.gardens enable row level security;
alter table public.plants enable row level security;
alter table public.waters enable row level security;
alter table public.reports enable row level security;
alter table public.prompt_suggestions enable row level security;
revoke all on public.gardens, public.plants, public.waters, public.reports, public.prompt_suggestions from anon, authenticated;

-- Helpers -------------------------------------------------------------------

create or replace function public._device_hash(p_device text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if p_device is null or p_device !~ '^[0-9a-f]{32}$' then
    raise exception 'bad device' using errcode = '22023';
  end if;
  return encode(extensions.digest(p_device, 'sha256'), 'hex');
end $$;

create or replace function public._clean(p text, maxlen int) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g')), maxlen), '')
$$;

create or replace function public._garden(p_slug text) returns public.gardens
language plpgsql stable set search_path = '' as $$
declare g public.gardens;
begin
  select * into g from public.gardens where slug = p_slug and not closed;
  if not found then raise exception 'garden not found' using errcode = 'P0002'; end if;
  return g;
end $$;

-- API -----------------------------------------------------------------------

create or replace function public.create_garden(p_device text, p_name text, p_kind text, p_pack text, p_lang text, p_anonymous boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); s text; n text := public._clean(p_name, 60);
begin
  if n is null then raise exception 'name required' using errcode = '22023'; end if;
  if (select count(*) from public.gardens where host_hash = h and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many gardens today' using errcode = '54000';
  end if;
  s := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
  insert into public.gardens (slug, name, kind, pack, lang, anonymous, host_hash)
  values (s, n, case when p_kind = 'circle' then 'circle' else 'friends' end, coalesce(public._clean(p_pack, 20), 'everyday'),
          case when p_lang = 'hi' then 'hi' else 'en' end, coalesce(p_anonymous, false), h);
  return json_build_object('slug', s);
end $$;

create or replace function public.get_garden(p_device text, p_slug text)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); g public.gardens := public._garden(p_slug);
begin
  return json_build_object(
    'slug', g.slug, 'name', g.name, 'kind', g.kind, 'pack', g.pack, 'lang', g.lang, 'anonymous', g.anonymous,
    'prompt', g.prompt, 'locked', g.locked, 'is_host', g.host_hash = h,
    'members', (select count(distinct author_hash) from public.plants where garden_id = g.id),
    'plants', coalesce((
      select json_agg(x order by x.created_at) from (
        select p.id, p.word, p.mood, p.prompt, p.waters, p.created_at,
               case when g.anonymous then null else p.author_name end as name,
               p.author_hash = h as mine,
               exists (select 1 from public.waters w where w.plant_id = p.id and w.author_hash = h) as watered,
               left(encode(extensions.digest(p.author_hash || g.id::text, 'sha256'), 'hex'), 10) as author_tag
        from public.plants p
        where p.garden_id = g.id and not p.hidden
        order by p.created_at desc limit 500
      ) x), '[]'::json)
  );
end $$;

create or replace function public.plant_word(p_device text, p_slug text, p_name text, p_word text, p_mood text, p_prompt text)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); g public.gardens := public._garden(p_slug); w text := public._clean(p_word, 280); v_id uuid;
begin
  if w is null then raise exception 'word required' using errcode = '22023'; end if;
  if g.locked then raise exception 'garden is locked' using errcode = '42501'; end if;
  if not exists (select 1 from public.plants where garden_id = g.id and author_hash = h)
     and g.host_hash <> h
     and (select count(distinct author_hash) from public.plants where garden_id = g.id) >= 30 then
    raise exception 'garden is full' using errcode = '54000';
  end if;
  if (select count(*) from public.plants where garden_id = g.id and author_hash = h and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'slow down' using errcode = '54000';
  end if;
  insert into public.plants (garden_id, author_hash, author_name, word, mood, prompt)
  values (g.id, h, case when g.anonymous then null else public._clean(p_name, 16) end, w,
          case when p_mood in ('happy', 'sad', 'angry', 'anxious', 'calm') then p_mood end, public._clean(p_prompt, 200))
  returning plants.id into v_id;
  update public.gardens set last_activity = now() where gardens.id = g.id;
  return json_build_object('id', v_id);
end $$;

create or replace function public.water_plant(p_device text, p_slug text, p_plant uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); g public.gardens := public._garden(p_slug); n int;
begin
  insert into public.waters (plant_id, author_hash)
  select p.id, h from public.plants p where p.id = p_plant and p.garden_id = g.id and p.author_hash <> h
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update public.plants set waters = waters + 1 where id = p_plant; end if;
  return json_build_object('waters', (select waters from public.plants where id = p_plant and garden_id = g.id));
end $$;

create or replace function public.report_plant(p_device text, p_slug text, p_plant uuid, p_reason text)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); g public.gardens := public._garden(p_slug); n int;
begin
  insert into public.reports (plant_id, author_hash, reason)
  select p.id, h, public._clean(p_reason, 200) from public.plants p where p.id = p_plant and p.garden_id = g.id
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update public.plants set reports = reports + 1, hidden = hidden or reports + 1 >= 3 or g.host_hash = h where id = p_plant;
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.remove_plant(p_device text, p_slug text, p_plant uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); g public.gardens := public._garden(p_slug);
begin
  delete from public.plants p where p.id = p_plant and p.garden_id = g.id and (p.author_hash = h or g.host_hash = h);
  return json_build_object('ok', found);
end $$;

create or replace function public.update_garden(p_device text, p_slug text, p_prompt text, p_anonymous boolean, p_locked boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); g public.gardens := public._garden(p_slug);
begin
  if g.host_hash <> h then raise exception 'only the host can do that' using errcode = '42501'; end if;
  update public.gardens set prompt = public._clean(p_prompt, 200), anonymous = coalesce(p_anonymous, anonymous),
         locked = coalesce(p_locked, locked), last_activity = now()
  where id = g.id;
  return json_build_object('ok', true);
end $$;

create or replace function public.close_garden(p_device text, p_slug text)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); g public.gardens := public._garden(p_slug);
begin
  if g.host_hash <> h then raise exception 'only the host can do that' using errcode = '42501'; end if;
  update public.plants set word = '-', author_name = null, prompt = null, mood = null, hidden = true where garden_id = g.id;
  update public.gardens set closed = true, name = '-', prompt = null where id = g.id;
  return json_build_object('ok', true);
end $$;

create or replace function public.suggest_prompt(p_device text, p_text text, p_lang text)
returns json language plpgsql security definer set search_path = '' as $$
declare h text := public._device_hash(p_device); t text := public._clean(p_text, 200);
begin
  if t is null or char_length(t) < 5 then raise exception 'too short' using errcode = '22023'; end if;
  if (select count(*) from public.prompt_suggestions where author_hash = h and created_at > now() - interval '1 day') >= 5 then
    raise exception 'thanks! that is plenty for today' using errcode = '54000';
  end if;
  insert into public.prompt_suggestions (text, lang, author_hash) values (t, case when p_lang = 'hi' then 'hi' else 'en' end, h);
  return json_build_object('ok', true);
end $$;

create or replace function public.list_prompts(p_lang text)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(text order by created_at), '[]'::json)
  from (select text, created_at from public.prompt_suggestions
        where status = 'approved' and lang = case when p_lang = 'hi' then 'hi' else 'en' end
        order by created_at desc limit 200) x
$$;

-- Only the API functions are callable from the app. Helpers stay private.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_garden(text, text, text, text, text, boolean),
  public.get_garden(text, text),
  public.plant_word(text, text, text, text, text, text),
  public.water_plant(text, text, uuid),
  public.report_plant(text, text, uuid, text),
  public.remove_plant(text, text, uuid),
  public.update_garden(text, text, text, boolean, boolean),
  public.close_garden(text, text),
  public.suggest_prompt(text, text, text),
  public.list_prompts(text)
to anon, authenticated;
