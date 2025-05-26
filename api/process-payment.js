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
        console.log('🔥 Processando pagamento REAL...');
        console.log('📝 Dados recebidos:', req.body);

        const { payment_method_id, payer, transaction_amount } = req.body;

        // Validação básica
        if (!payment_method_id || !payer || !transaction_amount) {
            return res.status(400).json({ 
                error: 'Dados obrigatórios ausentes',
                received: { payment_method_id, payer, transaction_amount }
            });
        }

        if (payment_method_id === 'pix') {
            console.log('📱 Gerando PIX REAL do Mercado Pago...');

            // Importar Mercado Pago dinamicamente
            const { MercadoPagoConfig, Payment } = await import('mercadopago');
            
            // Sua credencial REAL
            const MP_ACCESS_TOKEN = 'APP_USR-7586214711012079-052523-5bad69684c25c61942721988b9ce9bf6-510034420';

            // Configurar cliente
            const client = new MercadoPagoConfig({
                accessToken: MP_ACCESS_TOKEN
            });

            const payment = new Payment(client);

            // Limpar e validar CPF
            const cpfLimpo = payer.identification.number.replace(/[^0-9]/g, '');
            
            if (cpfLimpo.length !== 11) {
                return res.status(400).json({ 
                    error: 'CPF deve ter 11 dígitos',
                    cpf_recebido: cpfLimpo,
                    tamanho: cpfLimpo.length
                });
            }

            // Dados do pagamento PIX REAL
            const dadosPagamento = {
                transaction_amount: parseFloat(transaction_amount),
                description: 'Recurso de Multa - Anula Fácil',
                payment_method_id: 'pix',
                payer: {
                    email: payer.email.trim(),
                    first_name: payer.first_name.trim(),
                    last_name: payer.last_name.trim(),
                    identification: {
                        type: 'CPF',
                        number: cpfLimpo
                    }
                },
                external_reference: `anula_facil_${Date.now()}`,
                date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            };

            console.log('📤 Enviando para Mercado Pago:', dadosPagamento);

            // Criar pagamento REAL
            const resultado = await payment.create({ body: dadosPagamento });

            console.log('📥 Resposta do Mercado Pago:', resultado);

            // Montar resposta
            const resposta = {
                id: resultado.id,
                status: resultado.status,
                payment_method_id: resultado.payment_method_id,
                external_reference: resultado.external_reference,
                date_created: resultado.date_created,
                date_of_expiration: resultado.date_of_expiration,
                is_real_mercadopago: true
            };

            // Extrair QR Code REAL
            if (resultado.point_of_interaction?.transaction_data?.qr_code) {
                resposta.qr_code = resultado.point_of_interaction.transaction_data.qr_code;
                resposta.qr_code_base64 = resultado.point_of_interaction.transaction_data.qr_code_base64;
                
                console.log('✅ PIX REAL gerado!');
                console.log('🔑 Tamanho do QR Code:', resposta.qr_code.length);
                console.log('💰 Valor:', transaction_amount);
                console.log('👤 Para:', payer.email);
                
            } else {
                console.log('❌ QR Code não encontrado na resposta');
                console.log('🔍 Estrutura completa:', JSON.stringify(resultado, null, 2));
                
                // Tentar encontrar o QR Code em outros lugares
                if (resultado.qr_code) {
                    resposta.qr_code = resultado.qr_code;
                    console.log('✅ QR Code encontrado em resultado.qr_code');
                }
            }

            return res.status(200).json(resposta);

        } else {
            // Outros métodos
            return res.status(200).json({
                id: 'test_' + Date.now(),
                status: 'pending',
                payment_method_id: payment_method_id,
                message: 'Método simulado'
            });
        }

    } catch (error) {
        console.error('💥 ERRO no Mercado Pago:', error);
        console.error('📊 Stack:', error.stack);
        console.error('📝 Message:', error.message);
        
        // Se for erro do Mercado Pago, mostrar detalhes
        if (error.cause && Array.isArray(error.cause)) {
            console.error('🔴 Erros específicos do MP:', error.cause);
            return res.status(400).json({
                error: 'Erro do Mercado Pago',
                details: error.cause,
                message: error.message
            });
        }

        return res.status(500).json({
            error: 'Erro interno',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}