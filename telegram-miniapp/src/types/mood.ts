export type MoodType = 'calm' | 'energy' | 'focus' | 'celebration' | 'connection' | 'surprise';

export interface MoodDefinition {
  id: MoodType;
  emoji: string;
  label: string;
  tagline: string;
  description: string;
  color: string;
  gradient: string;
  accentHex: string;
  // External music recommendations (curated and copyright-safe / universal deeplinks)
  music: {
    title: string;
    artistOrCurator: string;
    spotifyUrl: string;
    appleMusicUrl: string;
    youtubeUrl: string;
  };
  // Suggested pairing with local menu items (F&B)
  pairingSuggestion: {
    itemType: string;
    description: string;
  };
}

export interface VibePassportRoute {
  id: string;
  title: string;
  theme: string;
  badge: string;
  description: string;
  estimatedHours: string;
  recommendedTime: string;
  stops: {
    order: number;
    category: string;
    vibeRequired: MoodType;
    actionDescription: string;
    pairingHint: string;
  }[];
}

export const VIBE_PASSPORT_ROUTES: VibePassportRoute[] = [
  {
    id: 'deep-work-flow',
    title: 'Ruta Creativa & Deep Work',
    theme: 'Enfoque & Calma',
    badge: 'Productividad',
    description: 'De la concentración matutina en barra de café a la calma inspiradora de la tarde.',
    estimatedHours: '4 - 6 hrs',
    recommendedTime: '09:00 - 15:00',
    stops: [
      {
        order: 1,
        category: 'Cafetería de Especialidad',
        vibeRequired: 'focus',
        actionDescription: 'Check-in Enfoque, Flat White y 90 minutos de trabajo ininterrumpido.',
        pairingHint: 'Espresso doble o Batch Brew',
      },
      {
        order: 2,
        category: 'Bistro o Barra Saludable',
        vibeRequired: 'energy',
        actionDescription: 'Almuerzo nutritivo para recargar glucosa cerebral sin pesadez.',
        pairingHint: 'Bowl de proteína fresca o Toast de masa madre',
      },
      {
        order: 3,
        category: 'Librería o Espacio Silencioso',
        vibeRequired: 'calm',
        actionDescription: 'Cierre de jornada, lectura reflexiva o revisión serena de tareas.',
        pairingHint: 'Infusión herbal o Matcha latte',
      },
    ],
  },
  {
    id: 'golden-hour-social',
    title: 'Ruta Social & Golden Hour',
    theme: 'Conexión & Celebración',
    badge: 'Vida Urbana',
    description: 'Encuentro con amigos, desconexión de fin de semana y tapeo de autor.',
    estimatedHours: '3 - 5 hrs',
    recommendedTime: '17:00 - 22:00',
    stops: [
      {
        order: 1,
        category: 'Terraza o Concept Coffee',
        vibeRequired: 'connection',
        actionDescription: 'Punto de reunión, charla relajada mientras cae el atardecer.',
        pairingHint: 'Cold Brew tónico o Mocktail cítrico',
      },
      {
        order: 2,
        category: 'Gastrobar o Pizzería Napolitana',
        vibeRequired: 'celebration',
        actionDescription: 'Cena compartida, brindis por logros y música Nu-Disco en sala.',
        pairingHint: 'Tabla de quesos, pizza artesanal o cóctel insignia',
      },
    ],
  },
];

export const MOOD_DEFINITIONS: Record<MoodType, MoodDefinition> = {
  calm: {
    id: 'calm',
    emoji: '☁️',
    label: 'Calma',
    tagline: 'Quiero bajar el ritmo',
    description: 'Espacios serenos, acústica suave y una pausa reconfortante.',
    color: 'from-sky-500/20 to-blue-600/10',
    gradient: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(37, 99, 235, 0.08) 100%)',
    accentHex: '#38BDF8',
    music: {
      title: 'Peaceful Ambient & Lo-Fi Chill',
      artistOrCurator: 'Rabbitty Acoustic Curations',
      spotifyUrl: 'https://open.spotify.com/playlist/10RPNFnZIwx4cvjSZmXKO6',
      appleMusicUrl: 'https://music.apple.com/playlist/lo-fi-jazz/pl.u-38oWZ4EFP2Z8v',
      youtubeUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    },
    pairingSuggestion: {
      itemType: 'Infusión o Flat White suave',
      description: 'Prueba una infusión botánica o café descafeinado con leche de avena.',
    },
  },
  energy: {
    id: 'energy',
    emoji: '☀️',
    label: 'Energía',
    tagline: 'Quiero activarme',
    description: 'Ritmo dinámico, frescura y motivación para el día.',
    color: 'from-amber-500/20 to-orange-600/10',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(234, 88, 12, 0.08) 100%)',
    accentHex: '#F59E0B',
    music: {
      title: 'Morning Motivation & Upbeat Rhythms',
      artistOrCurator: 'Rabbitty Energetic Beats',
      spotifyUrl: 'https://open.spotify.com/playlist/5zJZwPFV6Ozb9FVwTMb5RP',
      appleMusicUrl: 'https://music.apple.com/playlist/pure-workout/pl.u-a6BllfK8v3zJ1',
      youtubeUrl: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
    },
    pairingSuggestion: {
      itemType: 'Espresso Tonic o Smoothie Cítrico',
      description: 'Una dosis chispeante para revitalizar tus sentidos de inmediato.',
    },
  },
  focus: {
    id: 'focus',
    emoji: '🌿',
    label: 'Enfoque',
    tagline: 'Quiero concentrarme',
    description: 'Binaural beats, jazz instrumental o deep focus para crear y pensar.',
    color: 'from-emerald-500/20 to-teal-600/10',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(13, 148, 136, 0.08) 100%)',
    accentHex: '#10B981',
    music: {
      title: 'Deep Focus & Minimal Piano',
      artistOrCurator: 'Rabbitty Deep Work Sessions',
      spotifyUrl: 'https://open.spotify.com/playlist/4MGlQHnU4JzCLXdYFC4IoT',
      appleMusicUrl: 'https://music.apple.com/playlist/pure-focus/pl.u-38oWZMzCP2Z8v',
      youtubeUrl: 'https://www.youtube.com/watch?v=DWcJFNfaw9c',
    },
    pairingSuggestion: {
      itemType: 'Matcha Ceremonial o Cold Brew',
      description: 'Energía prolongada y antioxidantes para un flujo de trabajo sin caídas.',
    },
  },
  celebration: {
    id: 'celebration',
    emoji: '🎉',
    label: 'Celebración',
    tagline: 'Quiero disfrutar',
    description: 'Vibra festiva, alegría contagiosa y momentos para festejar logros.',
    color: 'from-pink-500/20 to-rose-600/10',
    gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(225, 29, 72, 0.08) 100%)',
    accentHex: '#EC4899',
    music: {
      title: 'Nu-Disco & Golden Hour Grooves',
      artistOrCurator: 'Rabbitty Party Sessions',
      spotifyUrl: 'https://open.spotify.com/playlist/4brS7twNzO8R83fZJIQPoj',
      appleMusicUrl: 'https://music.apple.com/playlist/dance-party/pl.u-Ymb00p5CPN3pM',
      youtubeUrl: 'https://www.youtube.com/watch?v=7NOSDKb0HlU',
    },
    pairingSuggestion: {
      itemType: 'Postre de la Casa o Cóctel Artesanal',
      description: 'Endulza el momento o brinda por tus metas alcanzadas.',
    },
  },
  connection: {
    id: 'connection',
    emoji: '🫶',
    label: 'Conexión',
    tagline: 'Quiero compartir',
    description: 'Charlas enriquecedoras, empatía y compartir con personas queridas.',
    color: 'from-purple-500/20 to-indigo-600/10',
    gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(79, 70, 229, 0.08) 100%)',
    accentHex: '#A855F7',
    music: {
      title: 'Warm Acoustic & Soulful Melodies',
      artistOrCurator: 'Rabbitty Acoustic Intimate',
      spotifyUrl: 'https://open.spotify.com/playlist/14cJUNppsCUM17JDJ3Q4H6',
      appleMusicUrl: 'https://music.apple.com/playlist/coffee-shop-acoustic/pl.u-V9D7m88tBkL3V',
      youtubeUrl: 'https://www.youtube.com/watch?v=lTRiuFIWV54',
    },
    pairingSuggestion: {
      itemType: 'Plato para Compartir o Jarra de Prensa',
      description: 'Ideal para alargar la conversación y crear memorias.',
    },
  },
  surprise: {
    id: 'surprise',
    emoji: '✨',
    label: 'Sorpresa',
    tagline: 'Sorpréndeme hoy',
    description: 'Sonidos eclécticos, experimentación y descubrir lo inesperado.',
    color: 'from-amber-400/20 to-violet-600/10',
    gradient: 'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(139, 92, 246, 0.12) 100%)',
    accentHex: '#FBBF24',
    music: {
      title: 'Eclectic Indie & Global Explorations',
      artistOrCurator: 'Rabbitty Sonic Discovery',
      spotifyUrl: 'https://open.spotify.com/playlist/4CkkBYkJbHpp5sa0xbOXlw',
      appleMusicUrl: 'https://music.apple.com/playlist/indie-mix/pl.u-9N9lv4DC4J6x3',
      youtubeUrl: 'https://www.youtube.com/watch?v=CF9X53Z82z0',
    },
    pairingSuggestion: {
      itemType: 'Sugerencia del Barista o Especial del Día',
      description: 'Pide la creación fuera de menú que el local recomienda hoy.',
    },
  },
};
