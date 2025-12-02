"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const supabase_1 = require("../config/supabase");
const node_forge_1 = __importDefault(require("node-forge"));
const router = express_1.default.Router();
/**
 * Valida o corpo da requisição para garantir que `idEmpresa` está presente.
 * @param body Objeto recebido na requisição
 * @returns boolean indicando se o body é válido
 */
function validateRequest(body) {
    return body && body.idEmpresa !== undefined && body.idEmpresa !== null;
}
/**
 * Faz o download de um certificado P12 a partir de uma URL.
 * @param url Endereço do arquivo P12
 * @returns Buffer contendo o conteúdo do arquivo P12
 */
async function downloadP12Certificate(url) {
    const response = await axios_1.default.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}
/**
 * Converte um buffer de certificado P12 em um agente HTTPS com certificado e chave PEM.
 * @param p12Buffer Buffer do certificado P12
 * @param passphrase Senha do certificado
 * @returns Instância de https.Agent para autenticação via certificado
 */
function createHttpsAgentWithP12(p12Buffer, passphrase) {
    const p12Asn1 = node_forge_1.default.asn1.fromDer(p12Buffer.toString('binary'));
    // O terceiro argumento (senha) é obrigatório; o segundo define se é strict. Usamos false como no código original
    const p12 = node_forge_1.default.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
    const bags = p12.getBags({ bagType: node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag });
    // Extraia os primeiros bags de chave e certificado. Use as as any para evitar erros de tipo.
    // Acesse os bags usando coerção para any para evitar checagens de undefined
    const keyBag = bags[node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag][0];
    const certBag = p12.getBags({ bagType: node_forge_1.default.pki.oids.certBag })[node_forge_1.default.pki.oids.certBag][0];
    const key = node_forge_1.default.pki.privateKeyToPem(keyBag.key);
    const cert = node_forge_1.default.pki.certificateToPem(certBag.cert);
    return new https_1.default.Agent({
        key,
        cert,
        rejectUnauthorized: false
    });
}
/**
 * Tenta gerar ou reutilizar o token base64 de autenticação a partir das credenciais disponíveis.
 */
function resolveTokenBase64(empresa) {
    if (empresa.tokenBase64)
        return empresa.tokenBase64;
    if (empresa.consumerKey && empresa.consumerSecret) {
        return Buffer.from(`${empresa.consumerKey}:${empresa.consumerSecret}`).toString('base64');
    }
    return null;
}
/**
 * Faz a autenticação com a API SERPRO usando um token base64 de consumer key/secret e um agente HTTPS.
 * @param tokenBase64 Credenciais base64 (consumerKey:consumerSecret)
 * @param httpsAgent Agente HTTPS com certificado
 * @returns Objeto com access_token e jwt_token
 */
async function authenticateWithSerpro(tokenBase64, httpsAgent) {
    // A requisição ao endpoint de autenticação do SERPRO exige grant_type no corpo e
    // cabeçalhos específicos. Reutilizamos a assinatura original, apenas substituindo
    // as credenciais por `tokenBase64`.
    const response = await axios_1.default.post('https://autenticacao.sapi.serpro.gov.br/authenticate', 'grant_type=client_credentials', {
        httpsAgent,
        headers: {
            Authorization: `Basic ${tokenBase64}`,
            'Role-Type': 'TERCEIROS',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data;
}
/**
 * Faz a autenticação na API DataValid do SERPRO usando o token base64 de consumer key/secret.
 * @param tokenBase64 Credenciais base64 (consumerKey:consumerSecret)
 * @returns Objeto com access_token
 */
async function authenticateDataValid(tokenBase64) {
    const res = await axios_1.default.post('https://gateway.apiserpro.serpro.gov.br/token', 'grant_type=client_credentials', {
        headers: {
            Authorization: `Basic ${tokenBase64}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
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
        console.log(`Recebendo solicitação de autenticação para empresa ${idEmpresa}`);
        // Buscar dados na tabela contabilidade
        const { data: empresa, error } = await supabase_1.supabase
            .from('contabilidade')
            .select('certitifcadoP12, senha, consumerKey, consumerSecret, tokenBase64')
            .eq('id', idEmpresa)
            .single();
        if (error) {
            console.error('Erro ao buscar empresa no Supabase:', error);
            return res.status(500).json({ error: 'Erro ao consultar a empresa no Supabase', details: error.message });
        }
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa não encontrada na tabela contabilidade' });
        }
        // Verificar se campos necessários estão presentes
        if (!empresa.certitifcadoP12 || !empresa.senha) {
            return res.status(400).json({ error: 'Certificado P12 ou senha ausentes' });
        }
        const tokenBase64 = resolveTokenBase64(empresa);
        if (!tokenBase64) {
            return res.status(400).json({ error: 'Credenciais SERPRO ausentes: informe tokenBase64 ou consumerKey/consumerSecret' });
        }
        // Baixar e processar o certificado P12
        const p12Buffer = await downloadP12Certificate(empresa.certitifcadoP12);
        const httpsAgent = createHttpsAgentWithP12(p12Buffer, empresa.senha);
        // Autenticar com SERPRO e DataValid usando o token base64
        const serpro = await authenticateWithSerpro(tokenBase64, httpsAgent);
        const datavalid = await authenticateDataValid(tokenBase64);
        // Atualizar tabela com os novos tokens
        const { error: updateError } = await supabase_1.supabase
            .from('contabilidade')
            .update({
            tokenJwt: serpro.jwt_token,
            accessToken: serpro.access_token,
            datavalid_jwt: datavalid.access_token
        })
            .eq('id', idEmpresa);
        if (updateError) {
            console.error('Erro ao atualizar tokens no Supabase:', updateError);
            return res.status(500).json({ error: 'Falha ao salvar tokens no Supabase', details: updateError.message });
        }
        return res.json({
            success: true,
            message: 'Tokens gerados e armazenados com sucesso',
            empresa: idEmpresa
        });
    }
    catch (e) {
        console.error('Falha geral no processo de autenticação:', e);
        return res.status(500).json({ error: 'Falha geral no processo', details: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map