# Changelog

Mudanças do Gutenberg que o operador percebe, da mais recente para a mais antiga.

## Formato

Baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versões
[SemVer](https://semver.org/lang/pt-BR/) iguais às do `package.json`.

- A seção `## [Não lançado]` fica sempre no topo e recebe as mudanças de cada commit.
- Ao gerar uma versão, ela vira `## [x.y.z] — AAAA-MM-DD` e uma nova `[Não lançado]` vazia sobe.
- Grupos, nesta ordem e só os que tiverem itens: **Adicionado**, **Alterado**, **Corrigido**,
  **Removido**, **Segurança**.
- Um item por mudança, em pt-BR, do ponto de vista de quem usa o app (não do código), com o
  épico entre parênteses no fim: `- Paginação na lista de hinos (E9)`.
- Mudanças sem efeito para o usuário (testes, refatoração, CI) não entram.

## [Não lançado]

### Adicionado
- Capítulos da Confissão de Westminster e listas de hinos paginados para caber na janela,
  sem rolagem; ←/→ trocam de página e a página é lembrada ao voltar de um item (E9)

## [0.1.0] — 2026-10-13

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
