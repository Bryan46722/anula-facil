import { MercadoPagoConfig, Payment } from 'mercadopago';

// CREDENCIAIS CORRETAS DE PRODUÇÃO
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || 'APP_USR-7586214711012079-052523-5bad69684c25c6194272198b9ce9bfb6-510034420',
    options: {
        timeout: 30000,
        sandbox: false // FORÇAR PRODUÇÃO
    }
});

const payment = new Payment(client);

export default async function handler(req, res) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        console.log('🚀 PRODUÇÃO REAL - Iniciando com credenciais corretas...');
        
        const { payment_method_id, payer, transaction_amount, plan, description } = req.body;

        // Validações básicas
        if (!payment_method_id || !payer || !transaction_amount) {
            return res.status(400).json({ 
                error: 'Dados obrigatórios não informados',
                required: ['payment_method_id', 'payer', 'transaction_amount']
            });
        }

        if (payment_method_id === 'pix') {
            console.log('💰 Gerando PIX REAL com credenciais de PRODUÇÃO...');

            // Limpar CPF
            const cpfLimpo = payer.identification.number.replace(/[^0-9]/g, '');
            
            // Dados completos para PIX de produção
            const paymentData = {
                transaction_amount: parseFloat(transaction_amount),
                description: description || 'Anula Fácil - Recurso de Multa',
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: {
                        type: 'CPF',
                        number: cpfLimpo
                    }
                },
                external_reference: `AF_PROD_${plan || 'individual'}_${Date.now()}`,
                notification_url: 'https://anulafacil.online/api/webhook',
                date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                
                // Informações adicionais para PIX real
                additional_info: {
                    items: [{
                        id: `anula_facil_${plan || 'individual'}`,
                        title: description || 'Recurso de Multa de Trânsito',
                        description: 'Serviço profissional de recurso administrativo',
                        category_id: 'services',
                        quantity: 1,
                        unit_price: parseFloat(transaction_amount)
                    }],
                    payer: {
                        first_name: payer.first_name,
                        last_name: payer.last_name,
                        phone: {
                            area_code: '11',
                            number: '999999999'
                        }
                    }
                }
            };

            console.log('📤 Enviando dados para MP (PRODUÇÃO):');
            console.log(JSON.stringify(paymentData, null, 2));
            
            // Verificar credencial sendo usada
            const accessToken = process.env.MP_ACCESS_TOKEN || paymentData.accessToken;
            console.log('🔑 Token usado:', accessToken?.substring(0, 30) + '...');
            console.log('🏭 Modo produção:', !accessToken?.includes('TEST'));

            const result = await payment.create({ body: paymentData });

            console.log('📥 RESPOSTA MERCADO PAGO:');
            console.log(JSON.stringify(result, null, 2));

            // Buscar QR Code em múltiplos locais
            let qrCode = null;
            let qrCodeBase64 = null;

            // Tentativas de encontrar o QR Code
            const searchPaths = [
                () => result.point_of_interaction?.transaction_data?.qr_code,
                () => result.point_of_interaction?.transaction_data?.qr_code_base64,
                () => result.transaction_details?.qr_code,
                () => result.qr_code
            ];

            for (const getQr of searchPaths) {
                const foundQr = getQr();
                if (foundQr && typeof foundQr === 'string' && foundQr.length > 50) {
                    qrCode = foundQr;
                    if (foundQr.startsWith('data:image')) {
                        qrCodeBase64 = foundQr;
                    }
                    console.log(`✅ QR Code encontrado! Tamanho: ${qrCode.length}`);
                    break;
                }
            }

            if (!qrCode) {
                console.log('❌ QR CODE NÃO ENCONTRADO!');
                console.log('🔍 Estrutura disponível:', {
                    keys: Object.keys(result),
                    point_of_interaction: result.point_of_interaction,
                    transaction_details: result.transaction_details
                });
                
                return res.status(500).json({
                    error: 'QR Code PIX não foi gerado',
                    payment_id: result.id,
                    status: result.status,
                    debug: {
                        available_keys: Object.keys(result),
                        point_of_interaction: result.point_of_interaction,
                        transaction_details: result.transaction_details,
                        token_type: accessToken?.includes('TEST') ? 'test' : 'production'
                    }
                });
            }

            // Validar PIX
            const validations = {
                starts_with_pix: qrCode.startsWith('00020101'),
                min_length: qrCode.length >= 100,
                has_bcb: qrCode.includes('br.gov.bcb.pix'),
                not_test: !qrCode.includes('test') && !qrCode.includes('sandbox')
            };

            console.log('🔍 VALIDAÇÕES PIX:');
            Object.entries(validations).forEach(([key, value]) => {
                console.log(`   ${key}: ${value ? '✅' : '❌'}`);
            });

            const isValidPix = validations.starts_with_pix && validations.min_length;

            if (!isValidPix) {
                console.log('❌ PIX INVÁLIDO!');
                console.log('🔍 Amostra:', qrCode.substring(0, 100));
                
                return res.status(500).json({
                    error: 'QR Code PIX inválido',
                    qr_preview: qrCode.substring(0, 50),
                    payment_id: result.id,
                    validations
                });
            }

            console.log('🎉 PIX PRODUÇÃO GERADO COM SUCESSO!');

            return res.status(200).json({
                id: result.id,
                status: result.status,
                payment_method_id: result.payment_method_id,
                qr_code: qrCode,
                qr_code_base64: qrCodeBase64,
                external_reference: result.external_reference,
                date_created: result.date_created,
                date_of_expiration: result.date_of_expiration,
                transaction_amount: result.transaction_amount,
                environment: 'production',
                is_valid_pix: isValidPix,
                validations
            });
        }

        // Outros métodos de pagamento
        return res.status(400).json({ error: 'Método de pagamento não suportado' });

    } catch (error) {
        console.error('💥 ERRO CRÍTICO:', error);
        console.error('📊 Stack:', error.stack);
        
        if (error.cause) {
            console.error('🔴 Detalhes MP:', error.cause);
            return res.status(400).json({
                error: 'Erro do Mercado Pago',
                details: error.cause,
                message: error.message
            });
        }

        return res.status(500).json({
            error: 'Erro interno',
            message: error.message
        });
    }
}