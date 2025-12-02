# Teste CURL para SERPRO Authentication

# 1. Primeiro, baixe o certificado P12 da URL da empresa:
curl -o certificado.p12 'https://rcimoewnbmaiqqmwcpwo.supabase.co/storage/v1/object/public/teste/M%20E%20INTEGRACOES%20E%20AUTOMACOES%20EMPRESARIAIS%20LTDA%202025-2026%20(1234).pfx'

# 2. Teste a autenticação com curl:
curl -i -X POST   -H 'Authorization: Basic RGREdWg4aHJSeFZ0STNTWjVUNjJhRmxsOHh3YTpxalZCWEsyZk5vZUFQa3hXc3lXNGV0NDBsX29h'   -H 'Role-Type: TERCEIROS'   -H 'Content-Type: application/x-www-form-urlencoded'   -d 'grant_type=client_credentials'   --cert-type P12   --cert certificado.p12:1234   'https://autenticacao.sapi.serpro.gov.br/authenticate'

# Para gerar o BASE64_CREDENTIALS:
echo -n 'CONSUMER_KEY:CONSUMER_SECRET' | base64

# Exemplo prático (substitua pelos valores reais):
echo -n 'djaR21PGoYp1iyK2n2ACOH9REdUb:ObRsAJWOL4fv2Tp27D1vd8fB3Ote' | base64


read -p "Pressione Enter para continuar..."