export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responder às requisições OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Aceitar apenas POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        console.log('🔍 Dados recebidos:', JSON.stringify(req.body, null, 2));

        const { payment_method_id, payer, transaction_amount, plan, description } = req.body;

        console.log('💰 Método de pagamento:', payment_method_id);
        console.log('👤 Dados do pagador:', payer);
        console.log('💵 Valor:', transaction_amount);
        console.log('📋 Plano:', plan);

        // Validar dados obrigatórios
        if (!payment_method_id || !payer || !transaction_amount) {
            return res.status(400).json({
                error: 'Dados obrigatórios ausentes',
                required: ['payment_method_id', 'payer', 'transaction_amount']
            });
        }

        // Validar dados do pagador
        if (!payer.email || !payer.first_name || !payer.last_name || !payer.identification) {
            return res.status(400).json({
                error: 'Dados do pagador incompletos',
                required: ['email', 'first_name', 'last_name', 'identification']
            });
        }

        // SUAS CREDENCIAIS DO MERCADO PAGO
        const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-7586214711012079-052523-5bad69684c25c61942721988b9ce9bf6-510034420';

        // Verificar se as credenciais estão configuradas
        if (!MP_ACCESS_TOKEN || MP_ACCESS_TOKEN === 'SUA_CREDENCIAL_AQUI') {
            console.log('❌ ERRO: Credenciais do Mercado Pago não configuradas!');
            return res.status(500).json({
                error: 'Credenciais do Mercado Pago não configuradas'
            });
        }

        console.log('🔑 Usando credenciais do Mercado Pago...');

        // Importar SDK do Mercado Pago
        const { MercadoPagoConfig, Payment } = await import('mercadopago');
        
        // Configurar cliente
        const client = new MercadoPagoConfig({
            accessToken: MP_ACCESS_TOKEN,
            options: {
                timeout: 5000,
                idempotencyKey: 'unique-key-' + Date.now()
            }
        });

        const payment = new Payment(client);

        // Processar PIX
        if (payment_method_id === 'pix') {
            console.log('📱 Processando PIX...');
            
            const paymentData = {
                transaction_amount: parseFloat(transaction_amount),
                description: description || `Recurso de Multa - Anula Fácil - ${plan || 'Plano Individual'}`,
                payment_method_id: 'pix',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: {
                        type: payer.identification.type || 'CPF',
                        number: payer.identification.number.replace(/\D/g, '') // Remove formatação
                    }
                },
                // PIX expira em 30 minutos
                date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                // Dados adicionais para controle
                external_reference: `anula_facil_${plan}_${Date.now()}`,
                notification_url: `${req.headers.origin || 'https://seusite.com'}/api/notifications`,
                metadata: {
                    plan: plan || 'individual',
                    source: 'anula_facil_website'
                }
            };

            console.log('📤 Enviando dados para Mercado Pago:', JSON.stringify(paymentData, null, 2));

            const paymentResponse = await payment.create({ body: paymentData });
            
            console.log('📥 Resposta do Mercado Pago:', JSON.stringify(paymentResponse, null, 2));

            // Estruturar resposta
            const response = {
                id: paymentResponse.id,
                status: paymentResponse.status,
                status_detail: paymentResponse.status_detail,
                payment_method_id: paymentResponse.payment_method_id,
                external_reference: paymentResponse.external_reference,
                date_created: paymentResponse.date_created,
                date_of_expiration: paymentResponse.date_of_expiration
            };

            // Verificar se o QR Code foi gerado
            if (paymentResponse.point_of_interaction && 
                paymentResponse.point_of_interaction.transaction_data) {
                
                const transactionData = paymentResponse.point_of_interaction.transaction_data;
                
                response.qr_code = transactionData.qr_code;
                response.qr_code_base64 = transactionData.qr_code_base64;
                response.ticket_url = transactionData.ticket_url;
                
                console.log('✅ QR Code PIX gerado com sucesso!');
                console.log('📱 QR Code length:', response.qr_code?.length || 0);
                
            } else {
                console.log('❌ Sem QR Code na resposta do Mercado Pago');
                console.log('🔍 Estrutura da resposta:', Object.keys(paymentResponse));
            }

            return res.status(200).json(response);

        } 
        // Processar Boleto
        else if (payment_method_id === 'bolbradesco' || payment_method_id === 'ticket') {
            console.log('🎫 Processando Boleto...');
            
            const paymentData = {
                transaction_amount: parseFloat(transaction_amount),
                description: description || `Recurso de Multa - Anula Fácil - ${plan || 'Plano Individual'}`,
                payment_method_id: 'bolbradesco',
                payer: {
                    email: payer.email,
                    first_name: payer.first_name,
                    last_name: payer.last_name,
                    identification: {
                        type: payer.identification.type || 'CPF',
                        number: payer.identification.number.replace(/\D/g, '')
                    }
                },
                // Boleto expira em 3 dias
                date_of_expiration: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                external_reference: `anula_facil_boleto_${plan}_${Date.now()}`,
                metadata: {
                    plan: plan || 'individual',
                    source: 'anula_facil_website'
                }
            };

            console.log('📤 Enviando dados do boleto para Mercado Pago...');

            const paymentResponse = await payment.create({ body: paymentData });
            
            console.log('📥 Resposta do boleto:', JSON.stringify(paymentResponse, null, 2));

            const response = {
                id: paymentResponse.id,
                status: paymentResponse.status,
                status_detail: paymentResponse.status_detail,
                payment_method_id: paymentResponse.payment_method_id,
                external_reference: paymentResponse.external_reference,
                date_created: paymentResponse.date_created,
                date_of_expiration: paymentResponse.date_of_expiration
            };

            // Adicionar URL do boleto se disponível
            if (paymentResponse.transaction_details && 
                paymentResponse.transaction_details.external_resource_url) {
                response.ticket_url = paymentResponse.transaction_details.external_resource_url;
                console.log('✅ URL do boleto gerada!');
            }

            return res.status(200).json(response);

        } 
        // Processar Cartão de Crédito
        else if (payment_method_id === 'credit_card' || payment_method_id.includes('visa') || payment_method_id.includes('master')) {
            console.log('💳 Processando Cartão de Crédito...');
            
            // Para cartão, você precisará implementar a tokenização
            // Por enquanto, retornamos erro pedindo implementação
            return res.status(400).json({
                error: 'Pagamento com cartão requer implementação adicional de tokenização',
                message: 'Use PIX ou Boleto por enquanto'
            });

        } 
        // Método de pagamento não suportado
        else {
            console.log('❌ Método de pagamento não suportado:', payment_method_id);
            return res.status(400).json({
                error: 'Método de pagamento não suportado',
                supported_methods: ['pix', 'bolbradesco'],
                received: payment_method_id
            });
        }

    } catch (error) {
        console.error('💥 Erro completo no processamento:', error);
        
        // Log detalhado do erro
        console.error('Stack trace:', error.stack);
        console.error('Erro name:', error.name);
        console.error('Erro message:', error.message);
        
        // Verificar se é erro do Mercado Pago
        if (error.cause && error.cause.length > 0) {
            console.error('Erros do Mercado Pago:', error.cause);
            return res.status(400).json({
                error: 'Erro na validação dos dados',
                details: error.cause.map(err => ({
                    code: err.code,
                    description: err.description
                }))
            });
        }
        
        // Erro genérico
        res.status(500).json({ 
            error: 'Erro interno do servidor',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}