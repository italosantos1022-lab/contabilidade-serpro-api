import express from 'express';
import axios from 'axios';
import https from 'https';
import { supabase } from '../config/supabase';
import forge from 'node-forge';

const router = express.Router();

/**
 * Valida o corpo da requisição para garantir que `idEmpresa` está presente.
 * @param body Objeto recebido na requisição
 * @returns boolean indicando se o body é válido
 */
function validateRequest(body: any) {
  return !!body.idEmpresa;
}

/**
 * Faz o download de um certificado P12 a partir de uma URL.
 * @param url Endereço do arquivo P12
 * @returns Buffer contendo o conteúdo do arquivo P12
 */
async function downloadP12Certificate(url: string): Promise<Buffer> {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

/**
 * Converte um buffer de certificado P12 em um agente HTTPS com certificado e chave PEM.
 * @param p12Buffer Buffer do certificado P12
 * @param passphrase Senha do certificado
 * @returns Instância de https.Agent para autenticação via certificado
 */
function createHttpsAgentWithP12(p12Buffer: Buffer, passphrase: string) {
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
  // O terceiro argumento (senha) é obrigatório; o segundo define se é strict. Usamos false como no código original
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

  const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  // Extraia os primeiros bags de chave e certificado. Use as as any para evitar erros de tipo.
  // Acesse os bags usando coerção para any para evitar checagens de undefined
  const keyBag: any = (bags as any)[forge.pki.oids.pkcs8ShroudedKeyBag][0];
  const certBag: any = (p12.getBags({ bagType: forge.pki.oids.certBag }) as any)[
    forge.pki.oids.certBag
  ][0];

  const key = forge.pki.privateKeyToPem(keyBag.key);
  const cert = forge.pki.certificateToPem(certBag.cert);

  return new https.Agent({
    key,
    cert,
    rejectUnauthorized: false
  });
}

/**
 * Faz a autenticação com a API SERPRO usando um token base64 de consumer key/secret e um agente HTTPS.
 * @param tokenBase64 Credenciais base64 (consumerKey:consumerSecret)
 * @param httpsAgent Agente HTTPS com certificado
 * @returns Objeto com access_token e jwt_token
 */
async function authenticateWithSerpro(tokenBase64: string, httpsAgent: https.Agent) {
  // A requisição ao endpoint de autenticação do SERPRO exige grant_type no corpo e
  // cabeçalhos específicos. Reutilizamos a assinatura original, apenas substituindo
  // as credenciais por `tokenBase64`.
  const response = await axios.post(
    'https://autenticacao.sapi.serpro.gov.br/authenticate',
    'grant_type=client_credentials',
    {
      httpsAgent,
      headers: {
        Authorization: `Basic ${tokenBase64}`,
        'Role-Type': 'TERCEIROS',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return response.data;
}

/**
 * Faz a autenticação na API DataValid do SERPRO usando o token base64 de consumer key/secret.
 * @param tokenBase64 Credenciais base64 (consumerKey:consumerSecret)
 * @returns Objeto com access_token
 */
async function authenticateDataValid(tokenBase64: string) {
  const res = await axios.post(
    'https://gateway.apiserpro.serpro.gov.br/token',
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${tokenBase64}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  return res.data;
}

/**
 * Rota principal de autenticação. Recebe somente `idEmpresa`, busca dados na tabela `contabilidade`,
 * gera tokens e os salva nas colunas apropriadas.
 */
router.post('/serpro', async (req, res) => {
  try {
    // Validação do corpo
    if (!validateRequest(req.body)) {
      return res.status(400).json({ error: 'idEmpresa é obrigatório no body.' });
    }
    const { idEmpresa } = req.body;

    // Buscar dados na tabela contabilidade
    const { data: empresa, error } = await supabase
      .from('contabilidade')
      .select('certitifcadoP12, senha, consumerKey, consumerSecret, tokenBase64')
      .eq('id', idEmpresa)
      .single();

    if (error || !empresa) {
      return res.status(404).json({ error: 'Empresa não encontrada na tabela contabilidade' });
    }

    // Verificar se campos necessários estão presentes
    if (!empresa.certitifcadoP12 || !empresa.senha) {
      return res.status(400).json({ error: 'Certificado P12 ou senha ausentes' });
    }
    if (!empresa.tokenBase64) {
      return res.status(400).json({ error: 'tokenBase64 não informado na empresa' });
    }

    // Baixar e processar o certificado P12
    const p12Buffer = await downloadP12Certificate(empresa.certitifcadoP12);
    const httpsAgent = createHttpsAgentWithP12(p12Buffer, empresa.senha);

    // Autenticar com SERPRO e DataValid usando o token base64
    const serpro = await authenticateWithSerpro(empresa.tokenBase64, httpsAgent);
    const datavalid = await authenticateDataValid(empresa.tokenBase64);

    // Atualizar tabela com os novos tokens
    await supabase
      .from('contabilidade')
      .update({
        tokenJwt: serpro.jwt_token,
        accessToken: serpro.access_token,
        datavalid_jwt: datavalid.access_token
      })
      .eq('id', idEmpresa);

    return res.json({
      success: true,
      message: 'Tokens gerados e armazenados com sucesso',
      empresa: idEmpresa
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Falha geral no processo', details: e.message });
  }
});

export default router;