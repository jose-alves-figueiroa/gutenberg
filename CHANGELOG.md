# Changelog

Mudanças do Gutenberg que o operador percebe, da mais recente para a mais antiga.

## Formato

Baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versões
[SemVer](https://semver.org/lang/pt-BR/) iguais às do `package.json`.

- A seção `## [Não lançado]` fica sempre no topo e recebe as mudanças de cada commit.
- Ao gerar uma versão, ela vira `## [x.y.z] - AAAA-MM-DD` e uma nova `[Não lançado]` vazia sobe.
- Grupos, nesta ordem e só os que tiverem itens: **Adicionado**, **Alterado**, **Corrigido**,
  **Removido**, **Segurança**.
- Um item por mudança, em pt-BR, do ponto de vista de quem usa o app (não do código), com o
  épico entre parênteses no fim: `- Paginação na lista de hinos (E9)`.
- Mudanças sem efeito para o usuário (testes, refatoração, CI) não entram.

## [Não lançado]

### Adicionado
- Biblioteca › Faixas: cultos e reuniões, sacramentos e pregadores editáveis, com a prévia da faixa
  como sai no OBS; uma faixa de culto sem linha de apoio usa a data do dia (E18)
- Liturgia › Pregação: pregador, título e texto pregado de cada culto, com a prévia da faixa (E18)
- Saída padrão "Faixas" (`/faixas`) e "Faixas de culto" entre as coleções do editor de saída: as
  faixas de culto, sacramento e pregação saem numa Browser Source própria, em bloco à esquerda;
  enviar uma faixa limpa o texto e pôr uma tela de texto no ar tira a faixa (E18)
- Controle remoto pelo celular: em Conexão › Controle remoto, aponte a câmera para o código e
  digite o PIN; o celular mostra a tela no ar e a seguinte, os itens da liturgia e Anterior,
  Próximo e Limpar tela. Um aparelho por vez, revogável na hora (E17)
- Esc limpa a tela no Apresentar (E16)

### Alterado
- A interface se amplia para preencher telas maiores (até 1,33× em 1920×1080 e 1920×1200),
  sem diminuir em 1280×720 (E16)
- Paginação no formato novo, "‹ Página x de y ›", e faixa de seções com botões maiores (E16)
- Capítulo da Bíblia sem rolagem: os versículos se dividem em seções pela altura da tela, a seção
  da seleção abre primeiro e a prévia da transmissão fica numa coluna à direita, paginada (E16)
- Hino aberto sem rolagem: número, título e autoria numa linha, a letra ocupa a altura que sobra,
  a prévia fica ao lado e as ações numa barra fixa embaixo; número vazio aparece como "s/nº" (E16)
- Liturgia em três colunas: cultos, itens paginados e "Adicionar à liturgia" à direita, com os
  resultados da busca limitados à altura da tela (E16)
- Catecismos sem rolagem: a grade de perguntas se ajusta ao espaço e o que não cabe vira seções
  (ex.: 1–112 · 113–196 em 1280×720) (E16)
- Apresentar sem rolagem: cartões de tela com altura fixa, e um item que não cabe na tela pagina
  (ex.: o Credo em 6 + 1 em 1280×720), com a página seguindo a tela no ar (E16)
- Editor de saída sem rolagem: a prévia se ajusta à altura disponível (E16)
- A Bíblia mostra os 66 livros, sem rolar; os que não têm texto ficam esmaecidos (E16)
- Busca na coleção com título "Busca: …", contagem de resultados e caminho de volta (E16)
- Hinos sem número aparecem como "s/nº" (E16)
- Letra maior no OBS: o tamanho vem de "Linhas máximas" da saída (padrão 12 linhas para textos e
  10 para músicas), em Source Serif 4, numa faixa escura na base da cena; saídas que ainda usavam
  os padrões do Holyrics passam para os novos (E15)
- Editor de saída com prévia ao vivo da cena 1920×1080 e as partes Coleções, Letra e Faixa:
  linhas máximas com o tamanho da letra em px, cor, alinhamento, fundo e opacidade da faixa,
  largura, margens, contorno e sombra; o cartão de cada saída mostra o resumo do estilo (E15)
- Guia do OBS: a fonte do navegador ocupa a cena inteira, sem redimensionar; como ajustar o
  tamanho da letra e o que fazer com texto pequeno (E15)

## [0.2.3] - 2026-10-14

### Adicionado
- No Mac, o app baixa a versão nova sozinho e instala em "Reiniciar e atualizar", sem precisar
  baixar o instalador no navegador; vale a partir da próxima versão, então esta ainda se instala
  pelo .dmg (E13)

### Alterado
- Aba Conexão em duas páginas, Estado e Saídas, sem rolagem: as saídas em cartões lado a lado e
  o registro paginado (E13)
- Textos da interface sem travessão (E13)

## [0.2.2] - 2026-10-13

### Alterado
- Versão de manutenção, sem mudanças no app: README com prints de cada tela e notas de versão
  com título no formato novo

## [0.2.1] - 2026-10-13

### Adicionado
- Busca na Biblioteca: na coleção aberta, por número, título ou referência (`42B`, `castelo`,
  `sl 119`, `1.2`); Enter abre o primeiro resultado (E12)
- Lista de cultos paginada na Liturgia (E12)

### Alterado
- Cultos aparecem do mais recente para o mais antigo, e o mais recente abre selecionado (E12)
- Salmo 119 sempre com uma letra hebraica por seção (1–8, 9–16…), sem dividir nem juntar
  letras (E12)
- Busca por número nos hinários mostra primeiro o número exato: `42` traz 42A e 42B antes de
  142 e 420 (E12)

## [0.2.0] - 2026-10-13

### Adicionado
- Itens longos aparecem uma seção por vez, com uma faixa para pular entre elas, no Apresentar,
  nos capítulos da Bíblia e nas prévias: o Salmo 119 é cortado pelas letras hebraicas (8, 16 ou
  24 versículos por seção, conforme cabe na janela), Lamentações 3 de 3 em 3 versículos, hinos
  por estrofe e os demais capítulos por versículos inteiros; Shift+←/→ pula de seção no
  Apresentar (E11)
- Aba Conexão mostra os 8 eventos mais recentes do registro, com "Ver todos" (E11)

## [0.1.0] - 2026-10-13

### Adicionado
- Abas Liturgia, Biblioteca, Apresentar e Conexão, no visual Broadsheet (E1)
- Quebra automática dos textos em telas de no máximo 2 linhas, igual ao protótipo (E2)
- Biblioteca completa: Bíblia ARA, Saltério de Genebra, Hinário Novo Cântico, credos,
  Confissão de Fé de Westminster, Breve Catecismo e Catecismo Maior (E3)
- Navegação e edição da biblioteca, com prévia das telas e "Adicionar à liturgia" (E4)
- Cadastro de cultos e da liturgia, com referências bíblicas e picker de itens (E5)
- Tela Apresentar com busca rápida, item avulso, tela preta e atalhos de teclado (E6)
- Saídas para o OBS por coleção (`/overlay/<saída>`), JSON compatível com o Holyrics
  (`/overlay/resources/<saída>`) e estado da conexão na aba Conexão (E7)
- Instaladores para Windows, macOS (Apple Silicon) e Ubuntu/Debian, com liberação do
  firewall (E8)
- Atualizações da biblioteca preservam as edições do operador (E8)
- Capítulos da Confissão de Westminster e listas de hinos paginados para caber na janela,
  sem rolagem; ←/→ trocam de página e a página é lembrada ao voltar de um item (E9)
- Atualização automática pelas versões publicadas no GitHub: no Windows e no Linux a versão
  nova é baixada em segundo plano e instalada ao fechar o app; no macOS, aviso com link para
  baixar. Versão instalada e "Verificar atualizações" na aba Conexão (E10)
