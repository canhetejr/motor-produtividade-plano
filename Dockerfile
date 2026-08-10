# Imagem de produção do Vértice. Três estágios para que a imagem final não
# carregue nem o npm cache nem o código-fonte — só o que o output tracing do
# Next provou ser necessário para servir.
#
# Node 22 porque package.json declara engines.node = "22.x".
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# As NEXT_PUBLIC_* são inlineadas no bundle durante o build, não lidas em
# runtime — precisam existir AQUI, como build args, e não adianta declará-las
# só nas variáveis do serviço. Não são segredo: a anon key é pública por
# construção (quem protege o dado é a RLS).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG SOURCE_COMMIT
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    SOURCE_COMMIT=$SOURCE_COMMIT \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build


FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# O health check do Coolify usa curl ou wget; a imagem base não inclui curl.
# Usuário sem privilégios: o processo não tem por que poder escrever na
# própria imagem.
RUN apk add --no-cache curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

# O server.js do standalone não copia public/ nem .next/static sozinho — são
# três COPY, e esquecer os dois últimos entrega um app que sobe e serve HTML
# sem CSS nem ícones.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
