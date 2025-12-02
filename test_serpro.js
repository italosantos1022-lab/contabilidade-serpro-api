const https = require('https');
const axios = require('axios');
const fs = require('fs');

async function testSerproWithCurl() {
    // Dados de exemplo - substitua pelos valores reais da sua empresa
    const empresa = {
        link_certificado_p12: 'URL_DO_SEU_CERTIFICADO_P12',
        senha_certificado: 'SENHA_DO_CERTIFICADO',
        serpro_consumer_key: 'SUA_CONSUMER_KEY',
        serpro_consumer_secret: 'SEU_CONSUMER_SECRET'
    };

    try {
        console.log('=== Teste SERPRO Authentication ===');
        
        // 1. Baixar o certificado
        console.log('1. Baixando certificado...');
        console.log(`URL: ${empresa.link_certificado_p12}`);
        
        const certResponse = await axios.get(empresa.link_certificado_p12, {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        
        const p12Buffer = Buffer.from(certResponse.data);
        console.log(`Certificado baixado: ${p12Buffer.length} bytes`);
        
        // Salvar temporariamente para testar com curl
        fs.writeFileSync('temp_cert.p12', p12Buffer);
        console.log('Certificado salvo como temp_cert.p12');
        
        // 2. Gerar Basic Auth
        const credentials = Buffer.from(`${empresa.serpro_consumer_key}:${empresa.serpro_consumer_secret}`).toString('base64');
        console.log(`\n2. Credenciais Basic Auth: ${credentials.substring(0, 20)}...`);
        
        // 3. Comando curl equivalente
        console.log('\n3. Comando curl para testar:');
        console.log(`curl -i -X POST \\`);
        console.log(`  -H "Authorization: Basic ${credentials}" \\`);
        console.log(`  -H "Role-Type: TERCEIROS" \\`);
        console.log(`  -H "Content-Type: application/x-www-form-urlencoded" \\`);
        console.log(`  -d "grant_type=client_credentials" \\`);
        console.log(`  --cert-type P12 \\`);
        console.log(`  --cert temp_cert.p12:${empresa.senha_certificado} \\`);
        console.log(`  "https://autenticacao.sapi.serpro.gov.br/authenticate"`);
        
        // 4. Teste com Node.js
        console.log('\n4. Testando com Node.js...');
        
        const httpsAgent = new https.Agent({
            pfx: p12Buffer,
            passphrase: empresa.senha_certificado,
            rejectUnauthorized: false
        });
        
        const response = await axios({
            url: 'https://autenticacao.sapi.serpro.gov.br/authenticate',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Role-Type': 'TERCEIROS',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: 'grant_type=client_credentials',
            httpsAgent: httpsAgent,
            timeout: 30000
        });
        
        console.log('✅ Sucesso!');
        console.log('Status:', response.status);
        console.log('Dados:', response.data);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    } finally {
        // Limpar arquivo temporário
        if (fs.existsSync('temp_cert.p12')) {
            fs.unlinkSync('temp_cert.p12');
            console.log('\nArquivo temporário removido');
        }
    }
}

// Execute o teste
testSerproWithCurl();