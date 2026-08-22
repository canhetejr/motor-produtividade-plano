---
name: vertice-design
description: Sistema de design do Vértice — identidade Tera Acid/Ink/Paper, tipografia Sora e JetBrains Mono, hierarquia de uma ação primária por tela, e a diferença entre os nomes do manual de marca e os tokens que o CSS realmente usa. Use SEMPRE que for criar ou alterar interface neste projeto: página, componente, tela, formulário, dashboard, e-mail, tela vazia, estado de erro ou qualquer coisa com cor, fonte, espaçamento ou logo. Use também quando o pedido for "deixar bonito", "ajustar o visual", "criar uma tela" ou mexer na marca.
---

# Design do Vértice

`docs/design/system.md` na raiz do repositório é o contrato de espaçamento, raios, componentes, movimento e acessibilidade — **leia-o antes de trabalho de interface de peso**. `docs/design/qa.md` é a lista de conferência.

**A seção de cores de `docs/design/system.md` (§2) está desatualizada.** Ela ainda descreve roxo/mint como marca primária/secundária a 60%/10%; a identidade visual padrão do produto migrou para **Tera Acid/Ink/Paper** (`app/globals.css` é a fonte de verdade real para cor — confira lá, não no manual). O resto de `docs/design/system.md` — tipografia, espaçamento, raios, movimento, voz — continua valendo.

Esta skill traz o que se erra com mais frequência e o que não é óbvio na leitura rápida.

## A ideia que organiza tudo

Um vértice é o ponto onde duas arestas se encontram, e também o ponto onde uma decisão acontece. A marca **não ilustra produtividade — ela desenha a estrutura dela.**

Isso tem consequência direta no layout, não é só narrativa de manual:

- **Convergência** — um número dominante por bloco, hierarquia agressiva. Dashboard não é uma grade de valores de mesmo peso.
- **Direção** — toda tela tem uma ação primária óbvia. **Nunca dois CTAs de mesmo peso.** Se dois botões parecem igualmente importantes, a tela ainda não foi projetada.
- **Evolução** — o ponto é um nó repetível; padrões gráficos derivam do ângulo 62°.

## A tabela que evita procurar token inexistente

O manual descreve a paleta; o CSS descreve o papel. Os nomes são diferentes de propósito, e é aqui que se perde tempo:

| No manual | No código (`app/globals.css`) |
|---|---|
| `--text-hi` | `--foreground` |
| `--text-mid` | `--muted-foreground` |
| `--border-subtle` | `--border` |
| `--font-display` / `--font-body` | `--font-heading` / `--font-sans` (ambos resolvem para Sora) |
| `--surface-1` / `--surface-2` | `--card` / `--popover` |
| `--space-*` | escala do Tailwind — o projeto não define escala própria |

Os semânticos invertem sozinhos entre tema claro e escuro. Use-os em vez de valores literais, ou o componente fica certo num tema e ilegível no outro.

## Cores

A identidade padrão é **Tera Acid/Ink/Paper** — um único acento (verde-limão "acid"), não mais roxo/mint como marca:

```
--tera-acid      #D7F75B   acento de marca — ação primária, seleção, foco
--tera-acid-deep #9EB83C   variante escura do acento (gráficos, hover)
--tera-ink       #101010   fundo escuro / texto sobre --paper
--tera-paper     #F5F3EF   fundo claro
```

`--v-purple` e `--v-mint` **continuam existindo no CSS como aliases de compatibilidade**, mas os dois hoje resolvem para `--tera-acid` — não são mais roxo (`#820AD1`) nem mint literal. Não escreva `#820AD1` nem trate roxo como cor de marca; se encontrar componente antigo com essa cor, é código que não migrou ainda, não um padrão a seguir.

**Roxo e mint só existem como uso semântico pontual, nunca como marca.** O único lugar em que o mint literal (`#00FFCE`) sobrevive é o token semântico `--success` — sucesso, foco positivo, indicador de "deu certo". Não reaproveite `--success` como cor decorativa nem crie um novo uso "de marca" para roxo ou mint.

**Alerta e erro ficam fora da paleta de marca e fora de `--success`.** Usam `--warning`/`--danger`, cada um com papéis próprios (`-texto`, `-superficie`, `-borda` — ver `app/globals.css`). Nunca reaproveite `--success` para erro: ele significa "deu certo" no resto do produto.

`--gradient-brand` (acid → ink) existe para peças institucionais. **A interface do produto não usa gradiente como decoração** — sem halos, sem manchas de fundo.

## Tipografia

**Sora** para display e interface (pesos 300–800 carregados). **JetBrains Mono** para dados: horas, códigos, datas, números técnicos.

| Papel | Peso | Tamanho |
|---|---|---|
| Título de página | 600 | 24px — um por tela, via `PageHeader` |
| Título de seção | 600 | 16px |
| Título de item/card | 500–600 | 14–16px |
| Corpo | 400 | 14px |
| KPI | 500–600 | 24–30px, sem peso 800/900 |

Todo texto com `letter-spacing: 0`. Caixa-alta só em códigos e estados muito curtos.

**A interface não varia tamanho de fonte por breakpoint.** Responsividade muda composição, largura e quebra de linha — não a hierarquia tipográfica. É a regra que mais se quebra sem perceber, geralmente via classes tipo `text-sm md:text-lg`.

Use os componentes `PageShell` e `PageHeader` que já existem, em vez de recriar cabeçalho de página.

## Voz

Direta, sentence case, verbo ativo. "Salvar alterações", não "Enviar".

**Erro diz o que houve e como resolver, sem pedir desculpa.** Compare: "Ops! Algo deu errado 😔" contra "Não foi possível salvar: a área selecionada não existe mais. Escolha outra." O segundo respeita quem está lendo.

**Tela vazia é convite para agir**, não aviso de ausência. "Nenhum apontamento hoje — registrar o primeiro" em vez de "Sem dados".

## Marca

Componentes prontos em `components/vertice-symbol.tsx`: `VerticeLogo`, `VerticeLockup`, `VerticeSymbol`. São recoloríveis via máscara CSS e seguem a preferência de cor do usuário — use-os em vez de referenciar PNG direto.

Assets em `public/brand/`, originais em `docs/assets/brand-source/`, geração de ícones por `scripts/gerar-icones.mjs` (`npm run icons`).

O lockup com a assinatura "UM PRODUTO TERA." existe e tem uso próprio. Não recrie o logo com texto, não distorça, não recolora fora dos componentes.

## Antes de dar por pronto

Passe por `docs/design/qa.md`. E abra no navegador, nos dois temas: o projeto tem histórico de funcionalidade que entrou sem ninguém ver a tela, e a maior parte do que quebra em design só aparece renderizado — contraste no tema escuro, quebra de linha em nome longo, KPI que não cabe, e o segundo CTA que ninguém percebeu que tinha o mesmo peso do primeiro.
