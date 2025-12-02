# SERPRO Authentication API

API simplificada para autenticação com a API SERPRO usando certificados P12.

## Funcionalidade

- ✅ Recebe `idEmpresa` e `idNumero`
- ✅ Busca informações no Supabase (certificado, consumer key, etc.)
- ✅ Faz autenticação na API SERPRO
- ✅ Salva o token na tabela do Supabase

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo de exemplo:
```bash
cp env.example .env
```

2. Configure as variáveis de ambiente no arquivo `.env`:
```env
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

3. Execute o script SQL no Supabase (arquivo `database/schema.sql`)

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

## Endpoint

### Autenticação SERPRO
```http
POST /api/auth/serpro
Content-Type: application/json

{
  "idEmpresa": "1",
  "idNumero": "1"
}
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Token gerado e salvo com sucesso na empresa",
  "data": {
    "empresa_id": "1",
    "id_numero": "1",
    "serpro_bearer": "af012866-daae-3aef-8b40-bd14e8cfac99",
    "serpro_jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 2008,
    "expires_at": "2024-01-01T12:33:28.000Z"
  }
}
```

## Estrutura do Banco de Dados

### Tabela `empresas`
- `id` - ID da empresa
- `nome` - Nome da empresa
- `cnpj` - CNPJ da empresa
- `link_certificado_p12` - URL para download do certificado P12
- `senha_certificado` - Senha do certificado P12
- `serpro_consumer_key` - Consumer Key para SERPRO
- `serpro_consumer_secret` - Consumer Secret para SERPRO
- `serpro_bearer` - Token de acesso (Bearer) da SERPRO
- `serpro_jwt` - JWT token da SERPRO
- `criado_em` - Data de criação
- `modificado_em` - Data de modificação

### Tabela `clientes`
- `id` - ID do cliente
- `nome` - Nome do cliente
- `cnpj` - CNPJ do cliente
- `numero_formato_whatsapp` - Número do WhatsApp
- `id_empresa` - ID da empresa (FK)
- `tipo_tributario` - Tipo tributário (MEI, etc.)
- `status` - Status do cliente (ativo/inativo)
- `teste` - Flag de teste
- `criado_em` - Data de criação
- `modificado_em` - Data de modificação

### Tabela `clientes_numeros`
- `id` - ID do número do cliente
- `id_cliente` - ID do cliente (FK)
- `responsavel` - Nome do responsável
- `numero_formato_whatsapp` - Número do WhatsApp formatado
- `ativo` - Status do número (ativo/inativo)
- `criado_em` - Data de criação
- `cpf` - CPF do responsável


## Exemplo de Uso

### cURL
```bash
curl -X POST http://localhost:3000/api/auth/serpro \
  -H "Content-Type: application/json" \
  -d '{
    "idEmpresa": "1",
    "idNumero": "1"
  }'
```

### JavaScript
```javascript
const response = await fetch('http://localhost:3000/api/auth/serpro', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    idEmpresa: '1',
    idNumero: '1'
  })
});

const result = await response.json();
console.log(result);
```

### Python
```python
import requests

url = 'http://localhost:3000/api/auth/serpro'
data = {
    'idEmpresa': '1',
    'idNumero': '1'
}

response = requests.post(url, json=data)
result = response.json()
print(result)
```

## Fluxo de Funcionamento

1. **Recebe requisição** com `idEmpresa` e `idNumero`
2. **Busca número do cliente** na tabela `clientes_numeros` usando `idNumero`
3. **Busca cliente** na tabela `clientes` usando `id_cliente` e `id_empresa`
4. **Busca empresa** na tabela `empresas` usando `idEmpresa` para obter certificado e credenciais
5. **Verifica credenciais** da empresa (serpro_consumer_key e serpro_consumer_secret)
6. **Baixa certificado** da URL armazenada na empresa
7. **Faz autenticação** na API SERPRO usando o certificado P12 e credenciais da empresa
8. **Salva tokens** diretamente na tabela `empresas` (serpro_bearer e serpro_jwt)
9. **Retorna sucesso** com os dados do token

## Endpoints de Teste

### Teste de Conexão com Supabase
```http
GET /api/auth/test-supabase
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Conexão com Supabase funcionando",
  "data": {
    "empresas": [
      {
        "id": "1",
        "nome": "Contador do João",
        "cnpj": "37.371.062/0001-10",
        "link_certificado_p12": "https://exemplo.com/certificado.p12",
        "serpro_consumer_key": "djaR21PGoYp1iyK2n2ACOH9REdUb",
        "serpro_consumer_secret": "ObRsAJWOL4fv2Tp27D1vd8fB3Ote",
        "serpro_bearer": null,
        "serpro_jwt": null
      }
    ],
    "clientes": [
      {
        "id": "1",
        "nome": "Coutodev",
        "cnpj": "43.351.991/0001-60",
        "id_empresa": "1",
        "status": "ativo"
      }
    ],
    "clientes_numeros": [
      {
        "id": "1",
        "id_cliente": "1",
        "responsavel": "Weverton Couto",
        "numero_formato_whatsapp": "5519981590411@s.whatsapp.net",
        "ativo": true
      }
    ]
  }
}
```

## Estrutura do Projeto

```
src/
├── config/
│   └── supabase.ts    # Configuração do Supabase
├── routes/
│   └── auth.ts        # Rota de autenticação
└── index.ts           # Servidor principal
```

## Logs

Os logs são exibidos no console e incluem:
- Requisições recebidas
- Erros de banco de dados
- Falhas de autenticação
- Erros de arquivo de certificado