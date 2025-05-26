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
        console.log('🔥 FORÇANDO PIX REAL - Início...');
        
        const { payment_method_id, payer, transaction_amount } = req.body;

        if (payment_method_id === 'pix') {
            console.log('📱 Importando Mercado Pago...');

            const { MercadoPagoConfig, Payment } = await import('mercadopago');
            
            // SUA CREDENCIAL DE PRODUÇÃO
            const ACCESS_TOKEN = 'APP_USR-7586214711012079-052523-5bad69684c25c61942721988b9ce9bf6-510034420';

            const client = new MercadoPagoConfig({
                accessToken: ACCESS_TOKEN,
                options: {
                    timeout: 30000
                }
            });

            const payment = new Payment(client);

            // Dados mais robustos para o PIX
            const paymentData = {
                transaction_amount: parseFloat(transaction_amount),
                description: 'Anula Facil - Recurso de Multa',
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: {
                        type: 'CPF',
                        number: payer.identification.number.replace(/[^0-9]/g, '')
                    }
                },
                external_reference: `AF_${Date.now()}`,
                notification_url: `${req.headers.origin || 'https://anulafacil.vercel.app'}/api/webhook`,
                date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                // Adicionando mais configurações para garantir PIX real
                additional_info: {
                    items: [{
                        id: 'anula_facil_recurso',
                        title: 'Recurso de Multa',
                        description: 'Serviço de recurso de multa de trânsito',
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

            console.log('📤 Dados do pagamento:');
            console.log(JSON.stringify(paymentData, null, 2));

            const result = await payment.create({ body: paymentData });

            console.log('📥 RESPOSTA COMPLETA:');
            console.log(JSON.stringify(result, null, 2));

            // Verificar múltiplos locais para o QR Code
            let qrCode = null;
            let qrCodeBase64 = null;

            // Local 1: point_of_interaction.transaction_data
            if (result.point_of_interaction?.transaction_data?.qr_code) {
                qrCode = result.point_of_interaction.transaction_data.qr_code;
                qrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
                console.log('✅ QR encontrado em point_of_interaction.transaction_data');
            }
            // Local 2: transaction_details
            else if (result.transaction_details?.qr_code) {
                qrCode = result.transaction_details.qr_code;
                console.log('✅ QR encontrado em transaction_details');
            }
            // Local 3: direto no resultado
            else if (result.qr_code) {
                qrCode = result.qr_code;
                console.log('✅ QR encontrado em result.qr_code');
            }

            if (!qrCode) {
                console.log('❌ NENHUM QR CODE ENCONTRADO!');
                console.log('🔍 Chaves disponíveis:', Object.keys(result));
                console.log('🔍 point_of_interaction:', result.point_of_interaction);
                
                return res.status(500).json({
                    error: 'QR Code não foi gerado',
                    payment_id: result.id,
                    status: result.status,
                    available_keys: Object.keys(result),
                    point_of_interaction: result.point_of_interaction
                });
            }

            console.log('🎉 QR CODE ENCONTRADO!');
            console.log('📏 Tamanho:', qrCode.length);
            console.log('🔑 Início:', qrCode.substring(0, 50));
            
            // Validar se é um PIX válido (deve começar com 00020101)
            if (!qrCode.startsWith('00020101')) {
                console.log('❌ QR Code não parece ser PIX válido!');
                console.log('🔍 QR Code completo:', qrCode);
                
                return res.status(500).json({
                    error: 'QR Code gerado não é PIX válido',
                    qr_code_preview: qrCode.substring(0, 100),
                    payment_id: result.id
                });
            }

            const response = {
                id: result.id,
                status: result.status,
                payment_method_id: result.payment_method_id,
                qr_code: qrCode,
                qr_code_base64: qrCodeBase64,
                external_reference: result.external_reference,
                date_created: result.date_created,
                date_of_expiration: result.date_of_expiration,
                is_real_pix: true,
                validation: {
                    starts_with_pix_format: qrCode.startsWith('00020101'),
                    length: qrCode.length,
                    has_bcb_reference: qrCode.includes('br.gov.bcb.pix')
                }
            };

            console.log('✅ RETORNANDO PIX VÁLIDO');
            return res.status(200).json(response);
        }

        return res.status(400).json({ error: 'Método não suportado' });

    } catch (error) {
        console.error('💥 ERRO:', error);
        console.error('📊 Stack:', error.stack);
        
        if (error.cause) {
            console.error('🔴 Erros MP:', error.cause);
            return res.status(400).json({
                error: 'Erro do Mercado Pago',
                details: error.cause
            });
        }

        return res.status(500).json({
            error: 'Erro interno',
            message: error.message
        });
    }
}