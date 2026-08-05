# Vértice — Design System

> Contrato de identidade visual para agentes de código e design.
> Fonte: **Vértice · Brand Book v1.0 — 2026**. Este arquivo é a única fonte de verdade.
> Se algo não estiver aqui, **pergunte** — não improvise.

---

## 0. Regras não-negociáveis

1. Nenhum valor de cor, tipografia, raio ou espaçamento fora dos tokens da seção 2 e 3.
2. O símbolo nunca é redesenhado, rotacionado, distorcido, recolorido ou reduzido em opacidade. Use os SVGs da seção 5.
3. Contraste mínimo **4,5:1** em qualquer texto ou elemento de interface.
4. Fundo padrão do produto é escuro (`--deep-space`). Tema claro usa `--paper` e a variação monocromática do símbolo.
5. Gradiente de marca (roxo → mint) só em **grandes superfícies**: splash, capa, hero, app icon. Nunca em botão, ícone pequeno, texto ou borda.
6. Um único padrão gráfico por peça, sempre atrás do conteúdo, **nunca sob texto corrido**.
7. Roxo domina (60%), mint é sinal (10%). Mint marca estado positivo, foco, dado-chave — não é cor decorativa.

---

## 1. Conceito

> Um vértice é o ponto onde duas arestas se encontram. É também o ponto onde uma decisão acontece.

Três pilares que devem se refletir em qualquer peça:

| Pilar | Significado | Como aparece na UI |
|---|---|---|
| **Convergência** | Demandas, times e indicadores encontram um único ponto de leitura | Dashboards com um número dominante por bloco; hierarquia agressiva |
| **Direção** | Duas arestas descendentes convergem — o sistema aponta para onde agir | Toda tela tem uma ação primária óbvia; nunca dois CTAs de mesmo peso |
| **Evolução** | O ponto é um nó vivo: repetível, expansível, base de todo o sistema gráfico | Ângulo 62° e o módulo do ponto geram padrões, ícones e loaders |

A marca **não ilustra produtividade — ela desenha a estrutura dela**. Toda linguagem gráfica deriva de duas arestas, um eixo e um ponto de encontro.

**Voz:** direta, sentence case, verbo ativo. "Salvar alterações", não "Enviar". Erro diz o que houve e como resolver, sem pedir desculpa. Tela vazia é convite para agir.

---

## 2. Cores

### Tokens

```css
:root {
  /* Marca */
  --v-purple:      #820AD1;  /* rgb(130,10,209) — primária · 60% */
  --v-mint:        #00FFCE;  /* rgb(0,255,206)  — secundária · 10% */

  /* Neutros */
  --deep-space:    #130B33;  /* fundo padrão do produto */
  --graphite:      #1F1F2B;  /* superfícies elevadas, cards em tema escuro */
  --steel:         #606070;  /* texto secundário, bordas, estados desabilitados */
  --paper:         #F6F6F8;  /* fundo do tema claro, papelaria */

  /* Derivados (uso restrito ao símbolo e a padrões gráficos) */
  --mint-deep:     #0FD9B6;
  --purple-light:  #A94BF0;


  /* Gradiente de marca — só grandes superfícies */
  --gradient-brand: linear-gradient(135deg, var(--v-purple) 0%, #5B37E0 48%, var(--v-mint) 100%);
}
```

> **Nomes que o código usa.** O produto implementa este sistema em
> `app/globals.css` com nomes semânticos por tema, não com os nomes literais
> acima — o manual descreve a paleta, o CSS descreve o papel. A tabela evita
> que alguém procure um token que não existe:
>
> | Manual | No CSS | Observação |
> |---|---|---|
> | `--text-hi` | `--foreground` | Inverte sozinho entre claro e escuro |
> | `--text-mid` | `--muted-foreground` | idem |
> | `--text-low` | `--muted-foreground` com opacidade | Não há degrau próprio |
> | `--border-subtle` | `--border` | idem |
> | `--font-display` / `--font-body` | `--font-heading` / `--font-sans` | Ambos resolvem para Sora |
> | `--surface-1` / `--surface-2` | `--card` / `--popover` | Superfícies elevadas, por tema |
> | `--space-*` | escala do Tailwind | O projeto não define escala própria de espaço |
> | `--radius-app` | — | Só o gerador de ícones usa; não é token de CSS |
>
> `--gradient-brand` existe no CSS para aplicações institucionais. A interface
> do produto não usa halos ou manchas de gradiente como decoração.

### Proporção obrigatória

```
Roxo 60%  ████████████████████████████████████
Neutros 30% ██████████████████
Mint 10%  ██████
```

### Semântica

| Uso | Token |
|---|---|
| Ação primária, seleção, marca | `--v-purple` |
| Sucesso, foco, indicador positivo, dado destacado | `--v-mint` |
| Alerta / erro | Fora da paleta de marca — definir separadamente, nunca reaproveitar mint ou roxo |
| Texto sobre fundo escuro | `--text-hi` / `--text-mid` |
| Texto sobre `--paper` | `--deep-space` / `--steel` |

---

## 3. Tipografia

**Sora** — display e interface (pesos 300, 400, 500, 600, 700 e 800 carregados).
**JetBrains Mono** — dados, labels, metadados, código.

```css
/* No CSS do produto: --font-heading e --font-sans (ver tabela na seção 4) */
--font-heading: 'Sora', system-ui, sans-serif;
--font-sans:    'Sora', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', ui-monospace, monospace;
```

### Escala

| Papel | Família | Peso | Tamanho | Tracking | Observação |
|---|---|---|---|---|---|
| **Título de página** | Sora | 600 | 24px | 0 | Um por tela, via `PageHeader` |
| **Título de seção** | Sora | 600 | 16px | 0 | Curto e em sentence case |
| **Título de item/card** | Sora | 500–600 | 14–16px | 0 | Nunca competir com o título da página |
| **Corpo** | Sora | 400 | 14px | 0 | Line-height confortável e texto direto |
| **Dados** | JetBrains Mono | 400–500 | 10–14px | 0 | Horas, códigos, datas e números técnicos |
| **KPI** | Sora ou JetBrains Mono | 500–600 | 24–30px | 0 | Número dominante, sem peso 800/900 |

```css
.page-title    { font-weight:600; font-size:1.5rem; letter-spacing:0; line-height:1.25; }
.section-title { font-weight:600; font-size:1rem;   letter-spacing:0; line-height:1.4; }
.body          { font-weight:400; font-size:.875rem; letter-spacing:0; line-height:1.6; }
.data          { font-family:var(--font-mono); font-weight:500; letter-spacing:0; }
```

**Regra:** a interface não varia tamanho de fonte por breakpoint. Responsividade muda composição, largura e quebra de linha, não a hierarquia tipográfica. Todo texto usa `letter-spacing: 0`; caixa-alta fica restrita a códigos e estados muito curtos.

---

## 4. Espaçamento, grid e raios

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px; --space-9: 96px;

--radius-sm: 4px;   /* inputs, tags */
--radius-md: 8px;   /* botões, cards, modais e painéis */
--radius-lg: 8px;   /* alias compatível; a UI nunca ultrapassa 8px */
--radius-app: 22%;  /* app icon — squircle */
```

Grid de layout: 12 colunas, gutter `--space-5`, max-width 1280px.
O símbolo e o wordmark são ativos proprietários. Não devem ser reconstruídos com
fontes ou formas aproximadas.

### Estrutura de página do produto

- Toda rota autenticada comum usa `PageShell` e `PageHeader` de `components/layout/page-shell.tsx`.
- Largura padrão: 1280px (`wide`). Formulários focados usam 768px (`narrow`) e listas intermediárias 1024px (`content`).
- Padding: 16px no mobile, 24px no tablet e 32px no desktop.
- Cabeçalho é uma faixa aberta com borda inferior; nunca um card flutuante.
- Card individual usa fundo sólido, borda de 1px e `shadow-xs`. Seções de página ficam sem moldura.
- Sombras médias ficam restritas a popovers; sombras fortes, apenas a elementos flutuantes que precisam separar-se do conteúdo.
- Cards não são aninhados. Ferramentas internas usam divisores ou superfícies `muted`.

---

## 5. Símbolo

### Geometria

- Monograma `V.` com hastes geométricas, encontro interno arredondado e ponto
  circular separado.
- Acabamento oficial em roxo com variação tonal sutil.
- O ponto faz parte do símbolo e nunca pode ser removido, deslocado ou reduzido
  separadamente.
- O arquivo mestre digital é `public/brand/vertice-symbol.png`.

### Área de proteção

Use ao redor do monograma uma margem mínima equivalente ao diâmetro do ponto.

### Tamanho mínimo

| Meio | Mínimo |
|---|---|
| Impresso | 8 mm |
| Digital | 24 px |

Abaixo do mínimo digital, use o ícone gerado com fundo `--deep-space`; não tente
separar o ponto ou redesenhar o monograma.

---

## 6. Assinaturas oficiais

| Variação | Quando usar |
|---|---|
| **Wordmark** `VÉRTICE.` | Sidebar aberta, cabeçalhos, relatórios e assinaturas compactas |
| **Lockup** `VÉRTICE. / UM PRODUTO TERA.` | Login, apresentações e comunicação institucional |
| **Símbolo** `V.` | Sidebar recolhida, favicon, app icon e redução extrema |

Os componentes oficiais são `VerticeLogo`, `VerticeLockup` e `VerticeSymbol`,
todos em `components/vertice-symbol.tsx`.

---

## 7. Aplicação sobre fundos

| Fundo | Versão |
|---|---|
| `--deep-space` / `--graphite` | Ativo oficial roxo, preservando transparência |
| `--paper` / branco | Ativo oficial roxo, preservando transparência |
| Launcher / PWA | Monograma sobre fundo sólido `--deep-space` |
| Fotografia | Somente sobre área de baixa informação e contraste comprovado |

---

## 8. Uso incorreto

- ❌ Distorcer proporções
- ❌ Rotacionar
- ❌ Recolorir fora da paleta
- ❌ Remover o ponto ou alterar sua distância
- ❌ Recortar o brilho ou a área de proteção
- ❌ Invadir a área de proteção
- ❌ Reconstruir o símbolo com texto, CSS, SVG manual ou uma fonte aproximada

---

## 9. Padrões gráficos

Os padrões preservam a linguagem geométrica e a presença do ponto da nova marca.

| Padrão | Especificação | Uso |
|---|---|---|
| **Marca d'água** | Símbolo ampliado a **10% de opacidade** | Fundo de capa, seção divisória |
| **Malha de vértices** | Pontos mint em grid de **22 U** | Fundo de painel, seção de dados |
| **Trama de arestas** | Linhas diagonais discretas, roxo + mint | Superfícies grandes, capa |

Regra: **um padrão por peça**, sempre atrás do conteúdo, nunca sob texto corrido.

```css
.pattern-mesh {
  background-image: radial-gradient(circle, rgba(0,255,206,.35) 1px, transparent 1px);
  background-size: 22px 22px;
}
```

---

## 10. Componentes de produto

### Botão

```css
.btn-primary {
  background: var(--v-purple); color: #fff;
  font-family: var(--font-body); font-weight: 400; letter-spacing: -.01em;
  padding: var(--space-3) var(--space-5); border-radius: var(--radius-md);
  border: none; transition: background .18s ease;
}
.btn-primary:hover  { background: #9313E8; }
.btn-primary:focus-visible { outline: 2px solid var(--v-mint); outline-offset: 2px; }

.btn-secondary {
  background: transparent; color: var(--text-hi);
  border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
}
```

Um único botão primário por tela. Sem gradiente em botão.

### Input

Fundo `--graphite`, borda 1px `--border-subtle`, raio `--radius-sm`, placeholder `--text-low`, foco: borda `--v-purple` + `outline` mint.

### Card / superfície

Fundo `--surface-1`, borda 1px `--border-subtle`, raio `--radius-md`, sem sombra pesada — profundidade vem do valor da superfície, não de blur.

### KPI

```
┌────────────────────┐
│ ENTREGUES          │  ← .label (mono, +10%, --text-low)
│                    │
│ 128                │  ← Display 200, --text-hi
└────────────────────┘
```

Valor positivo em destaque usa `--v-mint` (ex.: SLA 96%). Demais em `--text-hi`.

### Kanban

Colunas: **Backlog · Em curso · Revisão · Feito**.
Cada card carrega uma barra de status na base:
`Backlog` → `--steel` · `Em curso` → `--v-purple` · `Revisão` → `--purple-light` · `Feito` → `--v-mint`.

### Login

Título "Entrar no Vértice" (Sora 400). Campos: `e-mail corporativo`, `senha`. Ação: `Continuar`.

---

## 11. Ícones, splash e movimento

| Peça | Especificação |
|---|---|
| **App icon** | Squircle raio **22%**, fundo gradiente de marca, símbolo colorido centralizado |
| **Favicon** | Símbolo sólido. Em 16px: sem gradiente |
| **Avatar** | Círculo `--v-mint` com símbolo `--deep-space`, ou círculo `--v-purple` com símbolo branco |
| **Splash** | Fundo `--deep-space` com `--gradient-halo`, assinatura horizontal centralizada |
| **Loading** | **O ponto gira no eixo.** Nenhum outro elemento se move. Barra de progresso mint, 2px |

Movimento: transições de 160–220ms, `ease-out`. Respeitar `prefers-reduced-motion` — sem rotação do ponto, apenas fade.

---

## 12. Papelaria

| Peça | Formato |
|---|---|
| Cartão | 85 × 55 mm — frente `--deep-space` com assinatura; verso `--v-purple` com símbolo negativo |
| Timbrado | A4, fundo `--paper`, símbolo monocromático no topo, `vertice.app` no rodapé |
| Slides | 16:9, fundo `--deep-space`, um layout por classe de conteúdo |

---

## 13. Acessibilidade

- Contraste mínimo 4,5:1 em texto; 3:1 em elementos de interface.
- `--v-mint` sobre `--deep-space`: aprovado. `--v-mint` sobre `--paper`: **reprovado** — não use mint como texto em tema claro.
- `--v-purple` sobre `--deep-space` em texto pequeno: **reprovado** — use apenas como fundo ou área ≥ 24px.
- Foco sempre visível: `outline: 2px solid var(--v-mint); outline-offset: 2px`.
- Alvos de toque ≥ 44 × 44px.

---

## 14. Tailwind

```js
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      vertice: { purple: '#820AD1', mint: '#00FFCE',
                 'purple-light': '#A94BF0', 'mint-deep': '#0FD9B6' },
      space: { DEFAULT: '#130B33', 1: '#180E3D', 2: '#1E1247' },
      graphite: '#1F1F2B', steel: '#606070', paper: '#F6F6F8',
    },
    fontFamily: {
      sans: ['Sora', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
    },
    letterSpacing: { display: '-.04em', title: '-.02em', label: '.10em' },
    borderRadius: { sm: '4px', md: '8px', lg: '16px' },
    backgroundImage: {
      'brand-gradient': 'linear-gradient(135deg,#820AD1 0%,#5B37E0 48%,#00FFCE 100%)',
      'brand-halo': 'radial-gradient(ellipse at center,rgba(130,10,209,.55) 0%,rgba(19,11,51,0) 70%)',
    },
  },
}
```

Fontes:
```html
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@200;300;400;600;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## 15. Checklist antes de entregar

- [ ] Nenhum hex fora dos tokens
- [ ] Proporção 60 / 30 / 10 respeitada
- [ ] Uma única ação primária na tela
- [ ] Símbolo em variação correta para o fundo
- [ ] Área de proteção livre
- [ ] Símbolo acima do tamanho mínimo, ou versão sólida
- [ ] Gradiente apenas em grande superfície
- [ ] No máximo um padrão gráfico, nunca sob texto corrido
- [ ] Display 200 usado só em hero / KPI
- [ ] Labels em JetBrains Mono, caixa-alta, tracking +10%
- [ ] Foco visível em todos os interativos
- [ ] Contraste verificado
- [ ] `prefers-reduced-motion` respeitado
- [ ] Responsivo até 360px

---

## 16. Governança

> Toda peça nova nasce de duas arestas e um ponto.

Dúvidas de aplicação, novos formatos e aprovações passam pelo time de marca antes da publicação — `brand@vertice.app`.

`Vértice · Brand Book v1.0 · 2026 · vertice.app`
