/** Brazilian Portuguese UI strings. Every user-facing text lives here, keyed in English. */
export const ptBR = {
  'app.brand': 'Gutenberg',

  'tabs.liturgy': 'Liturgia',
  'tabs.library': 'Biblioteca',
  'tabs.present': 'Apresentar',
  'tabs.connection': 'Conexão',

  'nav.sections': 'Seções',
  'nav.quickSearch': 'Busca rápida',
  'nav.quickSearchPlaceholder': 'Buscar: hb 12.14, bc 1, sg 133…',
  'nav.openConnection': '{status} — abrir Conexão',

  'connection.online.label': 'OBS conectado',
  'connection.unstable.label': 'Conexão instável',
  'connection.offline.label': 'OBS sem resposta',
  'connection.offline.short': 'tentando {ip}',

  'liturgy.aside': 'Cultos',
  'liturgy.empty': 'Os cultos e a ordem dos itens aparecem aqui.',
  'library.aside': 'Coleções',
  'library.empty': 'Bíblia, hinário, salmos e textos de doutrina.',
  'present.aside': 'Itens',
  'present.empty': 'As telas do item no ar aparecem aqui.',
  'connection.empty': 'Estado da ligação com o OBS e registro de eventos.',

  'library.loading': 'Carregando…',
  'library.error': 'Não foi possível carregar a biblioteca.',
  'library.chooseBook': 'Escolha o livro',
  'library.oldTestament': 'Antigo Testamento',
  'library.newTestament': 'Novo Testamento',
  'library.chooseChapter': 'Escolha o capítulo',
  'library.chapterCount.one': '1 capítulo',
  'library.chapterCount.other': '{n} capítulos',
  'library.chapter': 'Capítulo {n}',
  'library.versesHint.start': 'Clique no primeiro versículo — e depois no último, para um trecho',
  'library.versesHint.extend': 'Clique em outro versículo para estender o trecho',
  'library.versesHint.restart': 'Clique em um versículo para recomeçar',

  'group.bible': 'Bíblia',
  'group.songs': 'Hinário e salmos',
  'group.doctrine': 'Doutrina',

  'slide.confession': '{name} {chapter}.{section}',
  'slide.catechismQuestion': '{name} · P. {number} · pergunta',
  'slide.catechismAnswer': '{name} · P. {number}',
  'slide.songLabeled': '{label} {number}{version}',
  'slide.songNumbered': '{number} · {title}'
} as const
