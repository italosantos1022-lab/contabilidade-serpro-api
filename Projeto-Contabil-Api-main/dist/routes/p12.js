"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.p12Routes = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const node_forge_1 = __importDefault(require("node-forge"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
exports.p12Routes = router;
// In-memory storage for certificates
const certificates = new Map();
const certificatesDir = path_1.default.join(process.cwd(), 'certificates');
// Ensure certificates directory exists
if (!fs_1.default.existsSync(certificatesDir)) {
    fs_1.default.mkdirSync(certificatesDir, { recursive: true });
}
// Configure multer for file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/x-pkcs12' || file.originalname.endsWith('.p12')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only P12 certificate files are allowed'));
        }
    }
});
// Helper function to validate certificate
async function validateCertificate(fileBuffer, password) {
    try {
        const p12Asn1 = node_forge_1.default.asn1.fromDer(fileBuffer.toString('binary'));
        const p12 = node_forge_1.default.pkcs12.pkcs12FromAsn1(p12Asn1, password);
        const certBags = p12.getBags({ bagType: node_forge_1.default.pki.oids.certBag });
        const certBag = certBags[node_forge_1.default.pki.oids.certBag]?.[0];
        if (!certBag) {
            return {
                isValid: false,
                error: 'Certificate not found in P12 file'
            };
        }
        const cert = certBag.cert;
        if (!cert) {
            return {
                isValid: false,
                error: 'Certificate is null'
            };
        }
        const now = new Date();
        if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
            return {
                isValid: false,
                error: 'Certificate is expired or not yet valid'
            };
        }
        return {
            isValid: true,
            serialNumber: cert.serialNumber,
            validFrom: cert.validity.notBefore,
            validTo: cert.validity.notAfter,
            issuer: cert.issuer.getField('CN')?.value || cert.issuer.toString(),
            subject: cert.subject.getField('CN')?.value || cert.subject.toString()
        };
    }
    catch (error) {
        return {
            isValid: false,
            error: error instanceof Error ? error.message : 'Invalid certificate format'
        };
    }
}
// Upload certificate
router.post('/upload', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'Certificate file is required'
            });
        }
        const { name, password } = req.body;
        if (!name || !password) {
            return res.status(400).json({
                error: 'Name and password are required'
            });
        }
        // Validate certificate
        const validation = await validateCertificate(req.file.buffer, password);
        if (!validation.isValid) {
            return res.status(400).json({
                error: `Invalid certificate: ${validation.error}`
            });
        }
        // Generate unique ID and save certificate
        const id = (0, uuid_1.v4)();
        const filePath = path_1.default.join(certificatesDir, `${id}.p12`);
        fs_1.default.writeFileSync(filePath, req.file.buffer);
        // Store certificate info
        const certificateInfo = {
            id,
            name,
            fileName: req.file.originalname,
            filePath,
            password,
            serialNumber: validation.serialNumber,
            validFrom: validation.validFrom,
            validTo: validation.validTo,
            issuer: validation.issuer,
            subject: validation.subject
        };
        certificates.set(id, certificateInfo);
        res.status(201).json({
            success: true,
            message: 'Certificate uploaded successfully',
            data: {
                id,
                name,
                fileName: req.file.originalname,
                serialNumber: validation.serialNumber,
                validFrom: validation.validFrom,
                validTo: validation.validTo,
                issuer: validation.issuer,
                subject: validation.subject
            }
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Failed to upload certificate',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Authenticate with SERPRO API
router.post('/serpro/authenticate', async (req, res) => {
    try {
        const { certificateId, consumerKey, consumerSecret } = req.body;
        if (!certificateId || !consumerKey || !consumerSecret) {
            return res.status(400).json({
                error: 'certificateId, consumerKey, and consumerSecret are required'
            });
        }
        const certificate = certificates.get(certificateId);
        if (!certificate) {
            return res.status(404).json({
                error: 'Certificate not found'
            });
        }
        if (!fs_1.default.existsSync(certificate.filePath)) {
            return res.status(404).json({
                error: 'Certificate file not found'
            });
        }
        // Create Basic Auth header
        const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        // Read certificate file
        const p12Buffer = fs_1.default.readFileSync(certificate.filePath);
        // Configure axios with P12 certificate directly
        const axiosConfig = {
            url: 'https://autenticacao.sapi.serpro.gov.br/authenticate',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Role-Type': 'TERCEIROS',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: 'grant_type=client_credentials',
            timeout: 30000,
            httpsAgent: new (require('https').Agent)({
                pfx: p12Buffer,
                passphrase: certificate.password,
                rejectUnauthorized: false
            })
        };
        // Make the request
        const response = await (0, axios_1.default)(axiosConfig);
        res.json({
            success: true,
            message: 'SERPRO authentication successful',
            data: {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data,
                certificateUsed: certificate.name
            }
        });
    }
    catch (error) {
        console.error('SERPRO authentication error:', error);
        res.status(500).json({
            error: 'SERPRO authentication failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Make request to SERPRO Integra Contador API
router.post('/serpro/request', async (req, res) => {
    try {
        const { certificateId, accessToken, jwtToken, requestData } = req.body;
        if (!certificateId || !accessToken || !jwtToken || !requestData) {
            return res.status(400).json({
                error: 'certificateId, accessToken, jwtToken, and requestData are required'
            });
        }
        const certificate = certificates.get(certificateId);
        if (!certificate) {
            return res.status(404).json({
                error: 'Certificate not found'
            });
        }
        if (!fs_1.default.existsSync(certificate.filePath)) {
            return res.status(404).json({
                error: 'Certificate file not found'
            });
        }
        // Read certificate file
        const p12Buffer = fs_1.default.readFileSync(certificate.filePath);
        // Configure axios with P12 certificate directly
        const axiosConfig = {
            url: 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/Consultar',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'jwt_token': jwtToken
            },
            data: requestData,
            timeout: 30000,
            httpsAgent: new (require('https').Agent)({
                pfx: p12Buffer,
                passphrase: certificate.password,
                rejectUnauthorized: false
            })
        };
        // Make the request
        const response = await (0, axios_1.default)(axiosConfig);
        res.json({
            success: true,
            message: 'SERPRO request completed successfully',
            data: {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data,
                certificateUsed: certificate.name
            }
        });
    }
    catch (error) {
        console.error('SERPRO request error:', error);
        res.status(500).json({
            error: 'SERPRO request failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Validate certificate
router.post('/validate', upload.single('certificate'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'Certificate file is required'
            });
        }
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({
                error: 'Password is required'
            });
        }
        const result = await validateCertificate(req.file.buffer, password);
        res.json({
            success: true,
            message: 'Certificate validation completed',
            data: result
        });
    }
    catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({
            error: 'Failed to validate certificate',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// List certificates
router.get('/certificates', async (req, res) => {
    try {
        const certs = Array.from(certificates.values());
        // Remove sensitive data
        const sanitizedCertificates = certs.map((cert) => ({
            id: cert.id,
            name: cert.name,
            fileName: cert.fileName,
            serialNumber: cert.serialNumber,
            validFrom: cert.validFrom,
            validTo: cert.validTo,
            issuer: cert.issuer,
            subject: cert.subject
        }));
        res.json({
            success: true,
            message: 'Certificates retrieved successfully',
            data: sanitizedCertificates
        });
    }
    catch (error) {
        console.error('List certificates error:', error);
        res.status(500).json({
            error: 'Failed to retrieve certificates',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
//# sourceMappingURL=p12.js.map