import { MercadoPagoConfig, Payment } from 'mercadopago';

// CONFIGURAÇÃO COMPLETA COM TODAS AS CREDENCIAIS DA IMAGEM
const client = new MercadoPagoConfig({
    accessToken: 'APP_USR-7586214711012079-052523-5bad69684c-25c6f94272198b9ce9bfb6-510034420',
    options: {
        timeout: 30000,
        sandbox: false
    },
    // CREDENCIAIS ADICIONAIS
    clientId: '7586214711012079',
    clientSecret: 'TauZ0iPpVmzo0Gfqg84EvyHSmESfi9eP'
});

const payment = new Payment(client);

export default async function handler(req, res) {
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
        console.log('🔥 CONFIGURAÇÃO COMPLETA - COM CLIENT ID E SECRET');
        
        const { payment_method_id, payer, transaction_amount, plan, description } = req.body;

        if (payment_method_id === 'pix') {
            const cpfLimpo = payer.identification.number.replace(/[^0-9]/g, '');
            
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
                external_reference: `AF_PROD_${Date.now()}`,
                notification_url: 'https://anulafacil.online/api/webhook',
                
                // DADOS COMPLETOS PARA APLICAÇÃO REAL
                sponsor_id: 510034420, // User ID da sua conta
                
                additional_info: {
                    items: [{
                        id: `anula_facil_${plan || 'individual'}`,
                        title: description || 'Recurso de Multa de Trânsito',
                        description: 'Serviço de recurso administrativo de multa',
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

            console.log('📤 DADOS COMPLETOS COM CLIENT CREDENTIALS:');
            console.log(JSON.stringify(paymentData, null, 2));
            console.log('🔑 Client ID:', '7586214711012079');
            console.log('🔐 Client Secret configurado:', 'TauZ0iPpVmzo0Gfqg84EvyHSmESfi9eP'.substring(0, 10) + '...');

            const result = await payment.create({ body: paymentData });

            console.log('📥 RESPOSTA COM CREDENCIAIS COMPLETAS:');
            console.log(JSON.stringify(result, null, 2));

            // BUSCAR QR CODE
            let qrCode = null;
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
                    console.log(`✅ QR encontrado com credenciais completas! Tamanho: ${qrCode.length}`);
                    break;
                }
            }

            if (!qrCode) {
                console.log('❌ QR não encontrado mesmo com credenciais completas');
                console.log('🔍 Debug completo:', {
                    payment_id: result.id,
                    status: result.status,
                    point_of_interaction: result.point_of_interaction,
                    transaction_details: result.transaction_details,
                    all_keys: Object.keys(result)
                });
                
                return res.status(500).json({
                    error: 'QR Code não gerado',
                    payment_id: result.id,
                    status: result.status,
                    message: 'Aplicação pode precisar ser ativada manualmente no MP',
                    debug: result
                });
            }

            // VALIDAR PIX
            const isValidPix = qrCode.startsWith('00020101') && qrCode.length >= 100;
            const isRealPix = isValidPix && 
                             !qrCode.includes('test') && 
                             !qrCode.includes('sandbox') &&
                             !qrCode.includes('example');

            console.log('🔍 VALIDAÇÕES PIX:');
            console.log(`   Formato válido: ${isValidPix}`);
            console.log(`   PIX real: ${isRealPix}`);
            console.log(`   Tamanho: ${qrCode.length}`);

            return res.status(200).json({
                id: result.id,
                status: result.status,
                payment_method_id: result.payment_method_id,
                qr_code: qrCode,
                external_reference: result.external_reference,
                date_created: result.date_created,
                date_of_expiration: result.date_of_expiration,
                transaction_amount: result.transaction_amount,
                is_valid_pix: isValidPix,
                is_real_pix: isRealPix,
                credentials: 'COMPLETE_WITH_CLIENT_ID_SECRET'
            });
        }

        return res.status(400).json({ error: 'Método não suportado' });

    } catch (error) {
        console.error('💥 ERRO COM CREDENCIAIS COMPLETAS:', error);
        console.error('📊 Detalhes:', error.cause);
        
        return res.status(500).json({
            error: 'Erro com credenciais completas',
            message: error.message,
            cause: error.cause
        });
    }
}