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
        console.log('🔥 FORÇA BRUTA - REQUEST DIRETO PARA MP API');
        
        const { payment_method_id, payer, transaction_amount, plan, description } = req.body;

        if (payment_method_id === 'pix') {
            const cpfLimpo = payer.identification.number.replace(/[^0-9]/g, '');
            
            // PAYLOAD DIRETO PARA API DO MP
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
                external_reference: `AF_${Date.now()}`,
                notification_url: 'https://anulafacil.online/api/webhook'
            };

            console.log('📤 REQUEST DIRETO PARA MP API...');

            // REQUEST MANUAL PARA API DO MERCADOPAGO
            const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer APP_USR-7586214711012079-052523-5bad69684c-25c6f94272198b9ce9bfb6-510034420',
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `${Date.now()}`,
                    'User-Agent': 'AnulaFacil/1.0'
                },
                body: JSON.stringify(paymentData)
            });

            if (!mpResponse.ok) {
                const errorData = await mpResponse.json();
                console.error('❌ Erro da API MP:', errorData);
                return res.status(400).json({
                    error: 'Erro da API MercadoPago',
                    details: errorData
                });
            }

            const result = await mpResponse.json();
            console.log('📥 RESPOSTA DIRETA DA API MP:');
            console.log(JSON.stringify(result, null, 2));

            // BUSCAR QR CODE
            let qrCode = null;
            const searchPaths = [
                () => result.point_of_interaction?.transaction_data?.qr_code,
                () => result.point_of_interaction?.transaction_data?.qr_code_base64,
                () => result.point_of_interaction?.qr_code,
                () => result.transaction_details?.qr_code,
                () => result.qr_code
            ];

            for (const getQr of searchPaths) {
                const foundQr = getQr();
                if (foundQr && typeof foundQr === 'string' && foundQr.length > 50) {
                    qrCode = foundQr;
                    console.log(`✅ QR encontrado! Tamanho: ${qrCode.length}`);
                    break;
                }
            }

            if (!qrCode) {
                console.log('❌ AINDA SEM QR CODE!');
                console.log('🔍 Estrutura completa:', JSON.stringify(result, null, 2));
                
                return res.status(500).json({
                    error: 'QR Code não foi gerado pela API',
                    payment_id: result.id,
                    status: result.status,
                    debug: result
                });
            }

            // VALIDAR SE É PIX REAL
            const isRealPix = qrCode.startsWith('00020101') && 
                             qrCode.length > 100 && 
                             !qrCode.includes('test') &&
                             !qrCode.includes('sandbox') &&
                             !qrCode.includes('example');

            console.log(`🔍 É PIX REAL?: ${isRealPix}`);
            console.log(`📏 Tamanho: ${qrCode.length}`);
            console.log(`🔤 Início: ${qrCode.substring(0, 30)}`);

            if (!isRealPix) {
                console.log('⚠️ PIX ainda parece ser de teste');
                console.log('🔍 Amostra completa:', qrCode.substring(0, 200));
            }

            return res.status(200).json({
                id: result.id,
                status: result.status,
                payment_method_id: result.payment_method_id,
                qr_code: qrCode,
                external_reference: result.external_reference,
                date_created: result.date_created,
                date_of_expiration: result.date_of_expiration,
                transaction_amount: result.transaction_amount,
                is_real_pix: isRealPix,
                api_method: 'DIRECT_API_CALL'
            });
        }

        return res.status(400).json({ error: 'Método não suportado' });

    } catch (error) {
        console.error('💥 ERRO FORÇA BRUTA:', error);
        return res.status(500).json({
            error: 'Erro na força bruta',
            message: error.message
        });
    }
}