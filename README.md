# Cardápio digital multi-restaurante

Aplicação de cardápio público e painel administrativo para vários restaurantes.
Sem configuração do Supabase, a página pública continua usando o cardápio
demonstrativo local.

## Desenvolvimento

Requisitos: Node.js 20.19+ (ou 22.12+) e npm.

```sh
npm install
npm run dev
```

Validação local:

```sh
npm run typecheck
npm run build
```

O GitHub Actions executa instalação, typecheck e build em pull requests para
`main` e em pushes para `main`.

## Supabase

Configure no ambiente de build do frontend:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_RESTAURANT_SLUG=
```

As duas primeiras variáveis habilitam autenticação e dados remotos. A chave
publishable pode estar no frontend; nunca configure uma secret key,
`service_role` ou credencial administrativa com prefixo `VITE_`. O slug de
desenvolvimento é opcional: `?restaurante=SLUG` na URL tem prioridade.

O menu público só carrega restaurantes `is_public = true` e produtos
disponíveis. No painel, `/admin` permite entrar e `/admin/dashboard` apresenta
as ferramentas da conta autenticada. Categorias, produtos e configurações são
protegidos pelas políticas RLS e associados ao restaurante da sessão. Links de
compartilhamento e QR Code incluem `?restaurante=SLUG`; a configuração do Vite
preserva o subcaminho `/projeto-cardapio/` e gera um fallback estático para
recarregar rotas administrativas no GitHub Pages.

As migrações são aplicadas pelo workflow `Deploy Supabase migrations` após
alterações em `supabase/migrations/` chegarem a `main`. Ele usa os GitHub
Secrets existentes `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` e
`SUPABASE_DB_PASSWORD`. O workflow de Edge Functions usa somente
`SUPABASE_ACCESS_TOKEN` e `SUPABASE_PROJECT_ID`, e publica com a API, sem
Docker.

Configure no secret manager das Edge Functions:

- `RESEND_API_KEY`
- `PROVISIONING_EMAIL_FROM`
- `PROVISIONING_ALLOWED_ORIGINS` (origens HTTPS exatas da aplicação)
- `PROVISIONING_REDIRECT_URL` (URL HTTPS de retorno do painel, por exemplo
  `https://<usuario>.github.io/projeto-cardapio/admin/dashboard`, permitida no
  Supabase Auth)

O Supabase injeta a URL e as chaves necessárias ao `@supabase/server`. Não
adicione essas chaves ao repositório, ao frontend ou aos secrets do GitHub para
deploy da função.

## Primeiro administrador da plataforma

O bootstrap não cria usuário nem restaurante e não é chamado pela aplicação.
Um operador confiável deve:

1. Aguardar a migration que cria `private.platform_admins` ser aplicada.
2. Criar ou selecionar no Supabase Auth a conta que será o primeiro
   administrador e copiar o UUID dessa conta existente.
3. Abrir `supabase/bootstrap/initial_platform_admin.sql`, substituir
   `first_platform_admin_id := null` pelo UUID copiado e revisar o arquivo.
4. Executar o bloco uma única vez por uma conexão PostgreSQL confiável cuja
   sessão seja `postgres` (por exemplo, o SQL Editor autenticado como operador
   com esse papel). O bloco verifica o papel, a existência do Auth user e que a
   tabela de administradores da plataforma está vazia.

Esse bootstrap só insere em `private.platform_admins`; não altera
`restaurant_admins`. Não invente nem reutilize um UUID de usuário diferente.
Depois do bootstrap, o administrador entra em `/admin`; a interface consulta a
Edge Function autenticada e só oferece provisionamento se a função confirmar
o status `platform_admin`. A Edge Function cria o novo usuário e restaurante
sem SQL manual por cliente.

Para o provisionamento, o workflow de deploy deve ter sido executado e os
secrets de e-mail/origem/redirect acima precisam estar configurados. A
propriedade `PROVISIONING_REDIRECT_URL` deve usar uma origem incluída em
`PROVISIONING_ALLOWED_ORIGINS` e cadastrada na allowlist de redirects do
Supabase Auth. Ao entrar pelo link inicial, o proprietário pode definir sua
própria senha no painel para os próximos acessos.

## Imagens

O MVP usa URLs HTTPS (`logo_url` e `image_url`); não há upload nem bucket de
Storage. Use imagens hospedadas em uma origem confiável.
