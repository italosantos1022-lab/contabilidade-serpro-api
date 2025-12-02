# SERPRO Authentication API

API em Node.js/TypeScript para obter tokens de autenticação da SERPRO e DataValid usando um certificado digital P12 armazenado no Supabase.

## Visão geral

- Recebe um `idEmpresa` no corpo da requisição.
- Busca credenciais na tabela `contabilidade` do Supabase.
- Faz download do certificado P12 informado na tabela, gera os tokens de acesso e grava os resultados na própria tabela.
- Expõe um _health check_ em `/health` para monitoramento.

## Requisitos

- Node.js 18+
- Conta e projeto no [Supabase](https://supabase.com/) com tabela `contabilidade` contendo, no mínimo, as colunas:
  - `id` (primary key)
  - `certitifcadoP12` (URL do arquivo P12)
  - `senha` (senha do P12)
  - `tokenBase64` (opcional se já armazenado)
  - `consumerKey` e `consumerSecret` (usados para gerar `tokenBase64` caso ele não exista)
  - `tokenJwt`, `accessToken` e `datavalid_jwt` (destinos onde os novos tokens são salvos)

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o arquivo `.env` a partir do modelo:

   ```bash
   cp env.example .env
   ```

3. Preencha as variáveis no `.env`:

   ```env
   PORT=3000
   NODE_ENV=development
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
   ```

## Execução

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
npm run build
npm start
```

## Endpoints

### POST `/api/auth/serpro`

Gera tokens SERPRO/DataValid para a empresa informada e grava na tabela.

Corpo da requisição:

```json
{
  "idEmpresa": 1
}
```

Resposta de sucesso:

```json
{
  "success": true,
  "message": "Tokens gerados e armazenados com sucesso",
  "empresa": 1
}
```

### GET `/health`

Retorna `{ "status": "ok" }` para sinalizar que a API está respondendo.

## Fluxo interno

1. Valida se `idEmpresa` foi informado.
2. Busca a linha correspondente na tabela `contabilidade`.
3. Gera `tokenBase64` a partir de `consumerKey`/`consumerSecret` se ele não estiver salvo.
4. Baixa o certificado P12 do endereço indicado e monta o agente HTTPS.
5. Solicita os tokens de autenticação da SERPRO e DataValid.
6. Atualiza a linha no Supabase com os tokens (`tokenJwt`, `accessToken`, `datavalid_jwt`).

## Scripts disponíveis

- `npm run dev` — executa o servidor com `nodemon`.
- `npm run build` — transpila o código TypeScript para `dist/`.
- `npm start` — inicia a versão transpilada.

## Observações

- As mensagens de erro são retornadas em português e incluem contexto adicional em caso de falhas no Supabase ou na autenticação externa.
- Para depuração, verifique os logs do console: requisições recebidas, erros de autenticação e respostas do Supabase são registrados.
