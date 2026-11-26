> Endere?os locais e comandos atualizados: [LOCAL_DEVELOPMENT_URLS.md](LOCAL_DEVELOPMENT_URLS.md). Exemplos antigos com 127.0.0.1 ou porta 3000 n?o s?o mais os endere?os p?blicos oficiais.

# SIDPB — tema de autenticação do Keycloak

## Escopo e referência visual

Atualização de 09/11/2026: veja [administração e pré-login](ADMINISTRATION_AND_PRELOGIN.md).
O tema usa a mesma imagem estática e o mesmo CSS de fundo do Next.js, sem Leaflet
ou tiles nas telas de autenticação, com card reto de 420px e logo dentro do card.
O relato de validação de 04/11 abaixo é histórico; a matriz atual distingue testes
reais, fixtures de apresentação e pendências externas.

O tema `sidpb` reproduz a linguagem visual da entrada pública do frontend: logo
oficial verde, fonte Arial/Helvetica, fundo cartográfico atenuado, cartão branco,
verde `#1B5E20` nas ações principais, bordas retas nos controles, foco verde
visível e espaçamentos equivalentes aos componentes de login. O layout responde
a telas estreitas sem rolagem horizontal e respeita `prefers-reduced-motion`.

O tema está em `infra/keycloak/themes/sidpb/login/` e herda de `keycloak`, o tema
de login distribuído no Keycloak 26.8.1. Somente recursos, propriedades e
traduções são sobrescritos; nenhum template FreeMarker foi copiado. Assim, login,
cadastro, Google, verificação de e-mail, recuperação, redefinição de senha e
mensagens continuam usando os formulários e ações oficiais da versão instalada.

## Docker e desenvolvimento

O serviço existente monta o diretório inteiro de temas em modo somente leitura:

```yaml
- ./infra/keycloak/themes:/opt/keycloak/themes:ro
```

O ambiente local continua usando `start-dev`. Nesse modo, o Keycloak desabilita
por padrão o cache de templates e recursos do tema. Depois que o volume estiver
montado, alterações em CSS, SVG e traduções aparecem com uma atualização forçada
do navegador; não é necessário reconstruir imagens ou reiniciar banco, API ou
frontend. Para aplicar a montagem pela primeira vez:

```powershell
docker compose --profile auth up -d --no-deps --force-recreate keycloak
```

Nenhuma opção de cache de produção foi alterada. Em produção, mantenha os caches
normais e distribua o mesmo diretório por imagem ou archive de tema, de acordo
com a operação daquele ambiente.

## Ativar e voltar ao padrão

No console administrativo, selecione o realm `sidpb` e acesse **Realm settings →
Themes → Login theme → sidpb**. Salve apenas essa opção. Não altere o realm
`master` nem o tema administrativo.

Para voltar, selecione **keycloak** em **Login theme** e salve. O helper local
oferece as mesmas operações sem substituir o realm:

```powershell
node infra/keycloak/configure-local.mjs --activate-theme
node infra/keycloak/configure-local.mjs --deactivate-theme
```

Esses comandos atualizam somente `loginTheme`. O script usa login administrativo
interativo e não registra tokens nem credenciais.

## Cadastro, senha e e-mail

O realm mantém `registrationEmailAsUsername=true`, `verifyEmail=true` e a execução
**Registration Password Validation** como obrigatória. Sua configuração atual é:

```text
always_set_password_on_register_form=true
```

Por isso o formulário oficial apresenta E-mail, Senha, Confirmar senha, Nome e
Sobrenome no cadastro inicial. A verificação do e-mail continua obrigatória antes
do acesso à aplicação.

No Keycloak 26.8.1, quando a verificação de e-mail está ativa, o comportamento
novo é verificar o endereço antes de solicitar a senha. A opção **Always set
password on register form** mantém o comportamento anterior e está depreciada;
existe para compatibilidade e pode ser removida em uma versão futura. O script
incremental `configure-auth.mjs` preserva explicitamente essa decisão sem alterar
SMTP ou usuários. Ele também configura incrementalmente o First Broker Login
do Google conforme o documento de refinamento. Ao atualizar o Keycloak, revise
essa opção e o fluxo de registro antes de publicar.

As páginas usam Português (Brasil) por padrão e oferecem inglês no seletor. As
traduções ficam em `messages/messages_pt_BR.properties` e
`messages/messages_en.properties`.

## Funcionamento preservado

O tema não adiciona JavaScript de autenticação, não lê senhas e não muda URLs,
cookies, sessões, clientes ou provedores. O Authorization Code Flow com PKCE S256,
state e nonce continua implementado pelo BFF do Next.js e pelo Keycloak. O botão
Google continua apontando ao provedor `google` já configurado. Redefinição,
verificação de e-mail, erros e sucessos usam as ações nativas do Keycloak.

## Validação local em 04/11/2026

Executado no Keycloak 26.8.1 do Compose, com o realm e o banco existentes:

- `docker compose --profile auth config --quiet`;
- healthcheck do Keycloak após recriar somente o container para montar o volume;
- inspeção do realm, confirmando tema `sidpb`, Google, verificação obrigatória e
  configuração depreciada dos campos de senha;
- `npm.cmd run test:auth:theme`, validando login, carregamento do CSS e logo,
  botão Google, erro de credenciais, os cinco campos de cadastro, recuperação de
  senha e responsividade em 390 × 844 e 1440 × 900;
- `npm.cmd run test:auth:e2e`, confirmando PKCE S256, redirecionamento ao SIDPB,
  sessões, cookies, login/logout e autorização USER/CURATOR/ADMIN com o tema ativo;
- inspeção visual das capturas de login desktop, cadastro mobile e recuperação
  mobile;
- `git diff --check` e typecheck do frontend.

O teste não conclui consentimento no Google nem envia mensagens para caixas reais.
Entrega SMTP, clique na verificação de e-mail e clique no link de redefinição
dependem de contas externas autorizadas. As telas correspondentes permanecem nos
templates oficiais herdados e recebem o mesmo CSS, mas esses três percursos devem
ser confirmados em homologação com Google e SMTP próprios do ambiente.

