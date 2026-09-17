import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Image,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  Search,
  Settings,
  Star,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './lib/supabase';
import type { Entry, Mood, Photo } from './types';

type View =
  | 'today'
  | 'diary'
  | 'calendar'
  | 'memories'
  | 'important'
  | 'search'
  | 'settings';

const moods: [Mood, string][] = [
  ['Happy', '😊'],
  ['Loved', '🥰'],
  ['Peaceful', '😌'],
  ['Normal', '😐'],
  ['Sad', '😔'],
  ['Angry', '😡'],
  ['Emotional', '😭'],
  ['Tired', '😴'],
  ['Excited', '🤩'],
  ['Overwhelmed', '🥺'],
];

const nav: [View, string, typeof CalendarDays][] = [
  ['today', 'Today', CalendarDays],
  ['diary', 'Diary', KeyRound],
  ['calendar', 'Calendar', CalendarDays],
  ['memories', 'Memories', Image],
  ['important', 'Important', Star],
  ['search', 'Search', Search],
  ['settings', 'Settings', Settings],
];

const iso = (d = new Date()) => d.toISOString().slice(0, 10);

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const emptyEntry = (date = iso()): Partial<Entry> => ({
  entry_date: date,
  title: '',
  content: '',
  mood: null,
  mood_note: '',
  thoughts: '',
  gratitude_1: '',
  gratitude_2: '',
  gratitude_3: '',
  best_moment: '',
  hardest_moment: '',
  weather: '',
  location: '',
  food: '',
  study_work: '',
  important: false,
  important_title: '',
  important_description: '',
});

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [locked, setLocked] = useState(
    () => sessionStorage.getItem('miri-unlocked') !== 'true',
  );
  const [view, setView] = useState<View>('today');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [chosenDate, setChosenDate] = useState(iso());
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(
    localStorage.getItem('miri-theme') || 'light',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('miri-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);

      if (data.session) {
        setLocked(
          sessionStorage.getItem('miri-unlocked') !== 'true',
        );
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (!newSession) {
        sessionStorage.removeItem('miri-unlocked');
        setLocked(false);
      } else if (sessionStorage.getItem('miri-unlocked') !== 'true') {
        setLocked(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!supabase || !session) return;

    const { data, error } = await supabase
      .from('diary_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('ENTRY LOAD ERROR:', error);
      return;
    }

    setEntries((data || []) as Entry[]);
  }, [session]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    if (!session || locked) return;

    const mins = Number(localStorage.getItem('miri-lock') || 10);

    if (!mins) return;

    let timer: number;

    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          sessionStorage.removeItem('miri-unlocked');
          setLocked(true);
        },
        mins * 60 * 1000,
      );
    };

    ['pointerdown', 'keydown', 'touchstart'].forEach((event) =>
      window.addEventListener(event, reset),
    );

    reset();

    return () => {
      window.clearTimeout(timer);

      ['pointerdown', 'keydown', 'touchstart'].forEach((event) =>
        window.removeEventListener(event, reset),
      );
    };
  }, [session, locked]);

  if (loading) {
    return (
      <div className="screen">
        <div className="brand">
          MÌRÌ
          <small>秘日 · secret days</small>
        </div>
      </div>
    );
  }

  if (!configured) {
    return <Setup />;
  }

  if (!session) {
    return <Login onSession={setSession} />;
  }

  if (locked) {
    return (
      <LockScreen
        email={session.user.email || ''}
        unlock={() => {
          sessionStorage.setItem('miri-unlocked', 'true');
          setLocked(false);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside>
        <Brand />

        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              onClick={() => setView(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <div className="side-bottom">
          <button
            onClick={() => {
              sessionStorage.removeItem('miri-unlocked');
              setLocked(true);
            }}
          >
            <Lock size={17} />
            Lock diary
          </button>

          <button
            onClick={() => {
              sessionStorage.removeItem('miri-unlocked');
              supabase?.auth.signOut();
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <main>
        <header className="mobile-head">
          <Brand />

          <button
            aria-label="Lock diary"
            onClick={() => {
              sessionStorage.removeItem('miri-unlocked');
              setLocked(true);
            }}
          >
            <Lock size={18} />
          </button>
        </header>

        <AnimatePresence mode="wait">
          <motion.section
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {renderView(view, {
              entries,
              chosenDate,
              setChosenDate,
              fetchEntries,
              setView,
              theme,
              setTheme,
              session,
            })}
          </motion.section>
        </AnimatePresence>
      </main>

      <nav className="mobile-nav">
        {nav.slice(0, 6).map(([id, label, Icon]) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            onClick={() => setView(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      MÌRÌ
      <small>秘日 · secret days</small>
    </div>
  );
}

function Setup() {
  return (
    <div className="screen setup">
      <Brand />

      <h1>Your private little world awaits.</h1>

      <p>
        Mìrì needs its Supabase connection before it can safely
        store anything.
      </p>

      <code>
        VITE_SUPABASE_URL=
        <br />
        VITE_SUPABASE_ANON_KEY=
      </code>

      <p>
        Add these values to <code>.env</code>, run the included
        migration in Supabase, then restart the app.
      </p>
    </div>
  );
}

function Login({
  onSession,
}: {
  onSession: (s: Session) => void;
}) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase) return;

    setBusy(true);
    setErr('');

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });

    setBusy(false);

    if (error) {
      console.error('LOGIN ERROR:', error);
      setErr("That doesn't seem to be the right key.");
      return;
    }

    if (data.session) {
      sessionStorage.setItem('miri-unlocked', 'true');
      onSession(data.session);
    }
  };

  return (
    <div className="screen login">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="login-card"
      >
        <Brand />

        <div className="lock-icon">🔐</div>

        <form onSubmit={submit}>
          <label>
            Email

            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            Enter your password

            <input
              type="password"
              autoComplete="current-password"
              required
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </label>

          {err && <p className="error">{err}</p>}

          <button className="primary" disabled={busy}>
            {busy ? 'UNLOCKING…' : 'UNLOCK'}
          </button>
        </form>

        <em>
          “Some days are meant
          <br />
          to be remembered.”
        </em>
      </motion.div>
    </div>
  );
}

function LockScreen({
  email,
  unlock,
}: {
  email: string;
  unlock: () => void;
}) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!supabase) return;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });

    if (error) {
      setPw('');
      setErr("That doesn't seem to be the right key.");
      return;
    }

    sessionStorage.setItem('miri-unlocked', 'true');
    unlock();
  };

  return (
    <div className="screen login">
      <div className="login-card">
        <div className="lock-icon">🔒</div>

        <Brand />

        <h2>Mìrì is locked.</h2>

        <p>Enter your password to continue.</p>

        <form onSubmit={submit}>
          <label>
            Enter your password

            <input
              aria-label="Enter your password"
              type="password"
              autoComplete="current-password"
              required
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </label>

          {err && <p className="error">{err}</p>}

          <button className="primary">UNLOCK</button>
        </form>
      </div>
    </div>
  );
}

function renderView(view: View, p: any) {
  switch (view) {
    case 'today':
      return <Today {...p} />;

    case 'diary':
      return <Timeline {...p} />;

    case 'calendar':
      return <Calendar {...p} />;

    case 'memories':
      return <Memories {...p} />;


    case 'important':
      return <Important {...p} />;

    case 'search':
      return <SearchPage {...p} />;

    case 'settings':
      return <SettingsPage {...p} />;
  }
}

function Today({
  entries,
  setChosenDate,
  setView,
}: any) {
  const today = entries.find(
    (x: Entry) => x.entry_date === iso(),
  );

  return (
    <div className="hero">
      <p className="eyebrow">MÌRÌ · 秘日</p>

      <h1>{fmtDate(iso())}</h1>

      <p className="prompt">
        “What will you remember about today?”
      </p>

      <button
        className="primary large"
        onClick={() => {
          setChosenDate(iso());
          setView('diary');
        }}
      >
        {today
          ? 'Continue today’s entry →'
          : '+ Write about today'}
      </button>

      <div className="little">
        <h3>Today’s little things</h3>

        <div>
          <span>😊 Mood</span>
          <span>🌤 Weather</span>
          <span>⭐ Important</span>
          <span>📷 Photos</span>
          <span>💭 Thought</span>
        </div>
      </div>

      <section className="recent">
        <h2>Recently remembered</h2>

        {entries.slice(0, 4).map((e: Entry) => (
          <button
            key={e.id}
            onClick={() => {
              setChosenDate(e.entry_date);
              setView('diary');
            }}
          >
            <span>
              {new Date(
                e.entry_date + 'T12:00',
              ).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>

            <strong>
              {e.title || 'An untitled day'}
            </strong>

            {e.important && <Star size={15} />}
          </button>
        ))}

        {!entries.length && (
          <p>This page is still waiting for a story.</p>
        )}
      </section>

      <p className="tagline">
        One day. One memory. One secret.
      </p>
    </div>
  );
}

function Timeline({
  entries,
  chosenDate,
  setChosenDate,
  fetchEntries,
}: any) {
  const [edit, setEdit] = useState(false);

  const entry = entries.find(
    (x: Entry) => x.entry_date === chosenDate,
  );

  return (
    <div className="two-col">
      <div className="timeline">
        <p className="eyebrow">Your diary</p>

        <h1>Days, kept quietly.</h1>

        {entries.map((x: Entry) => (
          <button
            className={
              x.entry_date === chosenDate ? 'selected' : ''
            }
            key={x.id}
            onClick={() => {
              setChosenDate(x.entry_date);
              setEdit(false);
            }}
          >
            <small>{fmtDate(x.entry_date)}</small>

            <strong>
              {x.important ? '⭐ ' : ''}
              {x.title || 'An untitled day'}
            </strong>

            <span>
              {x.content?.slice(0, 90) ||
                'A page waiting for words.'}
            </span>
          </button>
        ))}

        <button
          className="new-day"
          onClick={() => {
            setChosenDate(iso());
            setEdit(true);
          }}
        >
          <Plus size={16} />
          Write a new day
        </button>
      </div>

      <EntryPanel
        entry={entry}
        date={chosenDate}
        editing={edit || !entry}
        done={async () => {
          await fetchEntries();
          setEdit(false);
        }}
      />
    </div>
  );
}

function EntryPanel({
  entry,
  date,
  editing,
  done,
}: {
  entry?: Entry;
  date: string;
  editing: boolean;
  done: () => void | Promise<void>;
}) {
  const [isEdit, setIsEdit] = useState(editing);

  useEffect(() => {
    setIsEdit(editing);
  }, [editing, date]);

  if (!isEdit && entry) {
    return (
      <article className="entry-paper">
        <p className="eyebrow">
          {fmtDate(entry.entry_date)}
        </p>

        <h1>{entry.title || 'An untitled day'}</h1>

        {entry.mood && (
          <p className="mood">
            {moods.find(
              (m) => m[0] === entry.mood,
            )?.[1]}{' '}
            {entry.mood}

            {entry.mood_note &&
              ` · ${entry.mood_note}`}
          </p>
        )}

        <div className="prose">
          {entry.content ||
            'This page is still waiting for a story.'}
        </div>

        {entry.thoughts && (
          <Detail
            label="💭 A thought I couldn’t stop thinking about"
            value={entry.thoughts}
          />
        )}

        <div className="details">
          {[
            entry.best_moment && [
              '🌸 Best part',
              entry.best_moment,
            ],
            entry.hardest_moment && [
              '🌧 Hardest part',
              entry.hardest_moment,
            ],
            entry.weather && [
              '🌤 Weather',
              entry.weather,
            ],
            entry.location && [
              '⌖ Place',
              entry.location,
            ],
            entry.food && ['🍜 Food', entry.food],
            entry.study_work && [
              '📚 Study / Work',
              entry.study_work,
            ],
          ]
            .filter(Boolean)
            .map((x: any) => (
              <Detail
                key={x[0]}
                label={x[0]}
                value={x[1]}
              />
            ))}
        </div>

        <PhotoManager entryId={entry.id} />


        <button
          className="soft"
          onClick={() => setIsEdit(true)}
        >
          Edit this memory
        </button>
      </article>
    );
  }

  return (
    <EntryForm
      initial={entry || emptyEntry(date)}
      done={done}
    />
  );
}

function PhotoManager({
  entryId,
}: {
  entryId: string;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [state, setState] = useState('');

  const load = useCallback(async () => {
    const client = supabase;

    if (!client) return;

    const { data, error } = await client
      .from('photos')
      .select('*')
      .eq('entry_id', entryId)
      .order('display_order');

    if (error) {
      console.error('PHOTO DATABASE LOAD ERROR:', error);
      setState('Could not load photos.');
      return;
    }

    const list = await Promise.all(
      (data || []).map(async (p: Photo) => {
        const { data: signedData, error: signedError } =
          await client.storage
            .from('diary-photos')
            .createSignedUrl(
              p.storage_path,
              60 * 60,
            );

        if (signedError) {
          console.error(
            'PHOTO SIGNED URL ERROR:',
            signedError,
          );
        }

        return {
          ...p,
          signedUrl: signedData?.signedUrl,
        };
      }),
    );

    setPhotos(list);
  }, [entryId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (
    files: FileList | null,
  ) => {
    const client = supabase;

    if (!files || !client) return;

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user) {
      console.error(
        'PHOTO USER ERROR:',
        userError,
      );
      setState('Please unlock Mìrì again.');
      return;
    }

    for (const file of Array.from(files)) {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ];

      if (
        !allowedTypes.includes(file.type) ||
        file.size < 1 ||
        file.size > 10 * 1024 * 1024
      ) {
        setState('Use JPG, PNG, WEBP or GIF images up to 10 MB.');
        continue;
      }

      setState('Adding photo…');

      const safe = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );

      const path =
        `${user.id}/${entryId}/` +
        `${crypto.randomUUID()}-${safe}`;

      console.log('Uploading photo:', path);

      const { data: uploaded, error } = await client.storage
        .from('diary-photos')
        .upload(path, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (error || !uploaded) {
        console.error('PHOTO UPLOAD ERROR:', error);

        setState(
          `Photo upload failed: ${error?.message || 'Unknown upload error'}`,
        );

        continue;
      }

      const { error: dbError } =
        await client.from('photos').insert({
          entry_id: entryId,
          user_id: user.id,
          storage_path: path,
          display_order: photos.length + 1,
        });

      if (dbError) {
        console.error(
          'PHOTO DATABASE INSERT ERROR:',
          dbError,
        );

        await client.storage
          .from('diary-photos')
          .remove([path]);

        setState(
          `Photo could not be saved: ${dbError.message}`,
        );

        continue;
      }

      setState('Photo saved ✓');
    }

    await load();
  };

  const remove = async (p: Photo) => {
    const client = supabase;

    if (
      !client ||
      !confirm('Delete this photo permanently?')
    ) {
      return;
    }

    const { error: storageError } =
      await client.storage
        .from('diary-photos')
        .remove([p.storage_path]);

    if (storageError) {
      console.error(
        'PHOTO DELETE STORAGE ERROR:',
        storageError,
      );
    }

    const { error: dbError } =
      await client
        .from('photos')
        .delete()
        .eq('id', p.id);

    if (dbError) {
      console.error(
        'PHOTO DELETE DATABASE ERROR:',
        dbError,
      );
    }

    await load();
  };

  return (
    <section className="photo-manager">
      <h3>Today’s memories</h3>

      <div className="inline-photos">
        {photos.map((p) => (
          <figure key={p.id}>
            {p.signedUrl ? (
              <img
                src={p.signedUrl}
                alt={
                  p.caption ||
                  'Diary memory'
                }
              />
            ) : (
              <div className="empty-photo">
                📷
              </div>
            )}

            <button
              aria-label="Delete photo"
              onClick={() => remove(p)}
            >
              <X size={14} />
            </button>
          </figure>
        ))}
      </div>

      <label className="soft upload">
        + Add photos

        <input
          aria-label="Add photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            upload(e.target.files);
            e.currentTarget.value = '';
          }}
        />
      </label>

      {state && <small>{state}</small>}
    </section>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="detail">
      <small>{label}</small>
      <p>{value}</p>
    </div>
  );
}

function EntryForm({
  initial,
  done,
}: {
  initial: Partial<Entry>;
  done: () => void | Promise<void>;
}) {
  const [form, setForm] =
    useState<Partial<Entry>>(initial);

  const [state, setState] = useState('');
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState('');
  const [tags, setTags] = useState('');

  const set = (
    key: keyof Entry,
    value: any,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const save = async () => {
    if (!supabase) {
      setState('Supabase is not configured.');
      return;
    }

    const entryDate = form.entry_date;
    if (!entryDate) {
      setState('Please choose a date.');
      return;
    }

    if (saving) return;

    setSaving(true);
    setState('Saving…');

    try {
      const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      console.error('ENTRY USER ERROR:', userError);
      setState('Please unlock Mìrì again.');
      return;
    }

    const user = userData.user;

    // Send only columns that actually belong to diary_entries.
    // This prevents stale/UI-only fields from breaking an upsert.
    const payload = {
      user_id: user.id,
      entry_date: entryDate,
      title: form.title?.trim() || '',
      content: form.content || '',
      mood: form.mood || null,
      mood_note: form.mood_note?.trim() || null,
      thoughts: form.thoughts?.trim() || null,
      gratitude_1: form.gratitude_1?.trim() || null,
      gratitude_2: form.gratitude_2?.trim() || null,
      gratitude_3: form.gratitude_3?.trim() || null,
      best_moment: form.best_moment?.trim() || null,
      hardest_moment: form.hardest_moment?.trim() || null,
      weather: form.weather?.trim() || null,
      location: form.location?.trim() || null,
      food: form.food?.trim() || null,
      study_work: form.study_work?.trim() || null,
      important: !!form.important,
      important_title: form.important_title?.trim() || null,
      important_description:
        form.important_description?.trim() || null,
    };

    const { data, error } = await supabase
      .from('diary_entries')
      .upsert(payload, {
        onConflict: 'user_id,entry_date',
      })
      .select('*')
      .single();

    if (error) {
      console.error('ENTRY SAVE ERROR:', error);
      setState(`Unable to save: ${error.message}`);
      return;
    }

    if (!data) {
      setState('Entry was not returned.');
      return;
    }

    const entryId = data.id;

    // Save people and tags in parallel so saving a day is much faster.
    const peopleList = people
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    const tagList = tags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

    const [peopleDelete, tagDelete] = await Promise.all([
      supabase
        .from('diary_people')
        .delete()
        .eq('entry_id', entryId),
      supabase
        .from('diary_tags')
        .delete()
        .eq('entry_id', entryId),
    ]);

    if (peopleDelete.error) {
      console.error('PEOPLE DELETE ERROR:', peopleDelete.error);
      setState(`People could not be saved: ${peopleDelete.error.message}`);
      return;
    }

    if (tagDelete.error) {
      console.error('TAGS DELETE ERROR:', tagDelete.error);
      setState(`Tags could not be saved: ${tagDelete.error.message}`);
      return;
    }

    const [peopleInsert, tagInsert] = await Promise.all([
      peopleList.length
        ? supabase.from('diary_people').insert(
            peopleList.map((name) => ({
              entry_id: entryId,
              user_id: user.id,
              name,
            })),
          )
        : Promise.resolve({ error: null }),
      tagList.length
        ? supabase.from('diary_tags').insert(
            tagList.map((tag) => ({
              entry_id: entryId,
              user_id: user.id,
              tag,
            })),
          )
        : Promise.resolve({ error: null }),
    ]);

    if (peopleInsert.error) {
      console.error('PEOPLE SAVE ERROR:', peopleInsert.error);
      setState(`People could not be saved: ${peopleInsert.error.message}`);
      return;
    }

    if (tagInsert.error) {
      console.error('TAGS SAVE ERROR:', tagInsert.error);
      setState(`Tags could not be saved: ${tagInsert.error.message}`);
      return;
    }

    setState('Saved ✓');
    await done();
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="entry-paper editor">
      <p className="eyebrow">
        {fmtDate(form.entry_date!)}
      </p>

      <label>
        Date
        <input
          type="date"
          value={form.entry_date || ''}
          onChange={(e) => set('entry_date', e.target.value)}
        />
      </label>

      <input
        className="title-input"
        aria-label="Entry title"
        placeholder="A strange little Thursday"
        value={form.title || ''}
        onChange={(e) =>
          set('title', e.target.value)
        }
      />

      <textarea
        className="content"
        aria-label="Diary entry"
        placeholder={'Dear Diary,\n\nToday...'}
        value={form.content || ''}
        onChange={(e) =>
          set('content', e.target.value)
        }
      />

      <section>
        <h3>How did today feel?</h3>

        <div className="moods">
          {moods.map(([name, emoji]) => (
            <button
              type="button"
              key={name}
              className={
                form.mood === name
                  ? 'picked'
                  : ''
              }
              onClick={() =>
                set('mood', name)
              }
            >
              {emoji}
              <span>{name}</span>
            </button>
          ))}
        </div>

        <input
          placeholder="A small note about the feeling…"
          value={form.mood_note || ''}
          onChange={(e) =>
            set('mood_note', e.target.value)
          }
        />
      </section>

      <textarea
        placeholder="💭 A thought I couldn't stop thinking about…"
        value={form.thoughts || ''}
        onChange={(e) =>
          set('thoughts', e.target.value)
        }
      />

      <section>
        <h3>🌱 Three little things</h3>

        {[1, 2, 3].map((n) => (
          <input
            key={n}
            placeholder={`${n}.`}
            value={
              (form as any)[
                `gratitude_${n}`
              ] || ''
            }
            onChange={(e) =>
              set(
                `gratitude_${n}` as keyof Entry,
                e.target.value,
              )
            }
          />
        ))}
      </section>

      <div className="form-grid">
        <textarea
          placeholder="🌸 Best part of today"
          value={form.best_moment || ''}
          onChange={(e) =>
            set(
              'best_moment',
              e.target.value,
            )
          }
        />

        <textarea
          placeholder="🌧 Hardest part of today"
          value={form.hardest_moment || ''}
          onChange={(e) =>
            set(
              'hardest_moment',
              e.target.value,
            )
          }
        />

        <input
          placeholder="Weather"
          value={form.weather || ''}
          onChange={(e) =>
            set('weather', e.target.value)
          }
        />

        <input
          placeholder="Location"
          value={form.location || ''}
          onChange={(e) =>
            set('location', e.target.value)
          }
        />

        <input
          placeholder="Food"
          value={form.food || ''}
          onChange={(e) =>
            set('food', e.target.value)
          }
        />

        <input
          placeholder="Study / Work"
          value={form.study_work || ''}
          onChange={(e) =>
            set(
              'study_work',
              e.target.value,
            )
          }
        />

        <input
          placeholder="People, separated by commas"
          value={people}
          onChange={(e) =>
            setPeople(e.target.value)
          }
        />

        <input
          placeholder="Tags, separated by commas"
          value={tags}
          onChange={(e) =>
            setTags(e.target.value)
          }
        />
      </div>

      <label className="important-toggle">
        <input
          type="checkbox"
          checked={!!form.important}
          onChange={(e) =>
            set(
              'important',
              e.target.checked,
            )
          }
        />

        ⭐ This is a day I want to remember
      </label>

      {form.important && (
        <>
          <input
            placeholder="Why is this important?"
            value={
              form.important_title || ''
            }
            onChange={(e) =>
              set(
                'important_title',
                e.target.value,
              )
            }
          />

          <textarea
            placeholder="A few words to return to…"
            value={
              form.important_description ||
              ''
            }
            onChange={(e) =>
              set(
                'important_description',
                e.target.value,
              )
            }
          />
        </>
      )}

      <div className="save-row">
        <button
          className="primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save this memory'}
        </button>

        <span>{state}</span>
      </div>
    </article>
  );
}

function Calendar({
  entries,
  setChosenDate,
  setView,
}: any) {
  const [date, setDate] =
    useState(new Date());

  const year = date.getFullYear();
  const month = date.getMonth();

  const first = new Date(
    year,
    month,
    1,
  );

  const start =
    (first.getDay() + 6) % 7;

  const days = new Date(
    year,
    month + 1,
    0,
  ).getDate();

  const found = (day: number) =>
    entries.find(
      (e: Entry) =>
        e.entry_date ===
        `${year}-${String(
          month + 1,
        ).padStart(2, '0')}-${String(
          day,
        ).padStart(2, '0')}`,
    );

  return (
    <div className="page">
      <p className="eyebrow">
        A map of your days
      </p>

      <div className="calendar-head">
        <button
          onClick={() =>
            setDate(
              new Date(
                year,
                month - 1,
                1,
              ),
            )
          }
        >
          <ChevronLeft />
        </button>

        <h1>
          {date.toLocaleDateString(
            undefined,
            {
              month: 'long',
              year: 'numeric',
            },
          )}
        </h1>

        <button
          onClick={() =>
            setDate(
              new Date(
                year,
                month + 1,
                1,
              ),
            )
          }
        >
          <ChevronRight />
        </button>
      </div>

      <div className="calendar">
        <b>Mon</b>
        <b>Tue</b>
        <b>Wed</b>
        <b>Thu</b>
        <b>Fri</b>
        <b>Sat</b>
        <b>Sun</b>

        {Array.from({
          length: start,
        }).map((_, i) => (
          <i key={'blank' + i} />
        ))}

        {Array.from(
          { length: days },
          (_, i) => {
            const day = i + 1;
            const entry = found(day);

            const dayString =
              `${year}-${String(
                month + 1,
              ).padStart(2, '0')}-${String(
                day,
              ).padStart(2, '0')}`;

            return (
              <button
                key={day}
                className={
                  entry
                    ? 'has-entry'
                    : ''
                }
                onClick={() => {
                  setChosenDate(dayString);
                  setView('diary');
                }}
              >
                {day}

                {entry && (
                  <small>
                    {entry.important
                      ? '⭐'
                      : '•'}
                  </small>
                )}
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}

function Memories({
  session,
}: {
  session: Session;
}) {
  const [photos, setPhotos] =
    useState<Photo[]>([]);

  const [light, setLight] =
    useState<Photo | null>(null);

  const [error, setError] =
    useState('');

  useEffect(() => {
    const load = async () => {
      if (!supabase || !session) return;

      const { data, error: dbError } =
        await supabase
          .from('photos')
          .select('*')
          .order('created_at', {
            ascending: false,
          })
          .limit(60);

      if (dbError) {
        console.error(
          'MEMORIES DATABASE ERROR:',
          dbError,
        );

        setError(dbError.message);
        return;
      }

      const signed =
        await Promise.all(
          (data || []).map(
            async (p: Photo) => {
              const {
                data: signedData,
                error: signedError,
              } = await supabase!.storage
                .from('diary-photos')
                .createSignedUrl(
                  p.storage_path,
                  60 * 60,
                );

              if (signedError) {
                console.error(
                  'MEMORIES SIGNED URL ERROR:',
                  signedError,
                );
              }

              return {
                ...p,
                signedUrl:
                  signedData?.signedUrl,
              };
            },
          ),
        );

      setPhotos(signed);
    };

    load();
  }, [session]);

  return (
    <div className="page">
      <p className="eyebrow">
        📷 Memories
      </p>

      <h1>
        Small moments, held still.
      </h1>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {!photos.length ? (
        <Empty text="No memories captured here yet." />
      ) : (
        <div className="gallery">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                setLight(p)
              }
            >
              {p.signedUrl ? (
                <img
                  loading="lazy"
                  src={p.signedUrl}
                  alt={
                    p.caption ||
                    'Diary memory'
                  }
                />
              ) : (
                <Image />
              )}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {light && (
          <motion.div
            className="lightbox"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={() =>
              setLight(null)
            }
          >
            <button className="close">
              <X />
            </button>

            {light.signedUrl && (
              <img
                src={light.signedUrl}
                alt={
                  light.caption ||
                  'Diary memory'
                }
              />
            )}

            <p>{light.caption}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Important({
  entries,
  setChosenDate,
  setView,
}: any) {
  const list = entries.filter(
    (e: Entry) => e.important,
  );

  return (
    <div className="page">
      <p className="eyebrow">
        ⭐ Important
      </p>

      <h1>
        The days I want to remember.
      </h1>

      {!list.length ? (
        <Empty text="Nothing marked unforgettable yet." />
      ) : (
        <div className="important-list">
          {list.map((e: Entry) => (
            <button
              key={e.id}
              onClick={() => {
                setChosenDate(
                  e.entry_date,
                );
                setView('diary');
              }}
            >
              <small>
                {fmtDate(
                  e.entry_date,
                )}
              </small>

              <h2>
                {e.important_title ||
                  e.title ||
                  'An important day'}
              </h2>

              <p>
                {e.important_description ||
                  e.content?.slice(
                    0,
                    160,
                  )}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchPage({
  entries,
  setChosenDate,
  setView,
}: any) {
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const n = q.toLowerCase();

    if (!n) return [];

    return entries.filter(
      (e: Entry) =>
        [
          e.title,
          e.content,
          e.thoughts,
          e.gratitude_1,
          e.gratitude_2,
          e.gratitude_3,
          e.best_moment,
          e.hardest_moment,
          e.weather,
          e.location,
          e.food,
          e.study_work,
        ].some((x) =>
          x?.toLowerCase().includes(n),
        ),
    );
  }, [q, entries]);

  return (
    <div className="page">
      <p className="eyebrow">
        🔎 Search
      </p>

      <h1>Find a memory.</h1>

      <input
        className="search"
        autoFocus
        placeholder="A word, a place, a feeling…"
        value={q}
        onChange={(e) =>
          setQ(e.target.value)
        }
      />

      {q && !results.length ? (
        <Empty text="No memory matched that." />
      ) : (
        <div className="search-results">
          {results.map((e: Entry) => (
            <button
              key={e.id}
              onClick={() => {
                setChosenDate(
                  e.entry_date,
                );
                setView('diary');
              }}
            >
              <small>
                {fmtDate(
                  e.entry_date,
                )}
              </small>

              <strong>
                {e.title ||
                  'An untitled day'}
              </strong>

              <p>
                {e.content?.slice(
                  0,
                  180,
                )}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPage({
  theme,
  setTheme,
  session,
}: any) {
  const [lock, setLock] =
    useState(
      localStorage.getItem(
        'miri-lock',
      ) || '10',
    );

  const saveLock = (value: string) => {
    setLock(value);

    localStorage.setItem(
      'miri-lock',
      value,
    );
  };

  return (
    <div className="page settings">
      <p className="eyebrow">
        ⚙ Settings
      </p>

      <h1>
        Keep this world yours.
      </h1>

      <section>
        <h3>Account</h3>

        <p>{session.user.email}</p>

        <button
          className="soft"
          onClick={() =>
            supabase?.auth.resetPasswordForEmail(
              session.user.email!,
              {
                redirectTo:
                  window.location
                    .origin,
              },
            )
          }
        >
          Send password reset email
        </button>
      </section>

      <section>
        <h3>Privacy</h3>

        <label>
          Auto-lock after{' '}
          <select
            value={lock}
            onChange={(e) =>
              saveLock(
                e.target.value,
              )
            }
          >
            <option value="5">
              5 minutes
            </option>

            <option value="10">
              10 minutes
            </option>

            <option value="20">
              20 minutes
            </option>

            <option value="30">
              30 minutes
            </option>

            <option value="0">
              Never
            </option>
          </select>
        </label>
      </section>

      <section>
        <h3>Appearance</h3>

        <div className="segmented">
          {[
            'light',
            'dark',
            'system',
          ].map((x) => (
            <button
              key={x}
              className={
                theme === x
                  ? 'picked'
                  : ''
              }
              onClick={() =>
                setTheme(x)
              }
            >
              {x}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Export</h3>

        <p>
          Exports are intentionally not
          available until a secure
          server-side export workflow is
          configured. Your raw data
          remains protected by RLS.
        </p>
      </section>
    </div>
  );
}

function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <div className="empty">
      ✦
      <p>{text}</p>
    </div>
  );
}