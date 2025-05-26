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
        console.log('🔥 INÍCIO - Processando pagamento...');
        console.log('📝 Body completo:', JSON.stringify(req.body, null, 2));

        const { payment_method_id, payer, transaction_amount } = req.body;

        // Validação básica
        if (!payment_method_id || !payer || !transaction_amount) {
            console.log('❌ Dados obrigatórios ausentes');
            return res.status(400).json({ 
                error: 'Dados obrigatórios ausentes',
                received: { payment_method_id, payer, transaction_amount }
            });
        }

        if (payment_method_id === 'pix') {
            console.log('📱 TENTANDO importar Mercado Pago...');

            try {
                // Importar Mercado Pago dinamicamente
                const mercadopagoModule = await import('mercadopago');
                console.log('✅ Mercado Pago importado com sucesso');
                console.log('📦 Módulos disponíveis:', Object.keys(mercadopagoModule));

                const { MercadoPagoConfig, Payment } = mercadopagoModule;
                
                // Sua credencial REAL
                const MP_ACCESS_TOKEN = 'APP_USR-7586214711012079-052523-5bad69684c25c61942721988b9ce9bf6-510034420';

                console.log('🔑 Configurando cliente com token:', MP_ACCESS_TOKEN.substring(0, 20) + '...');

                // Configurar cliente
                const client = new MercadoPagoConfig({
                    accessToken: MP_ACCESS_TOKEN,
                    options: {
                        timeout: 30000
                    }
                });

                console.log('✅ Cliente configurado');

                const payment = new Payment(client);

                // Limpar e validar CPF
                const cpfLimpo = payer.identification.number.replace(/[^0-9]/g, '');
                
                console.log('🆔 CPF processado:', cpfLimpo);
                
                if (cpfLimpo.length !== 11) {
                    console.log('❌ CPF inválido');
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

                console.log('📤 ENVIANDO para Mercado Pago:');
                console.log(JSON.stringify(dadosPagamento, null, 2));

                // Criar pagamento REAL
                console.log('🚀 Chamando payment.create...');
                const resultado = await payment.create({ body: dadosPagamento });

                console.log('📥 RESPOSTA COMPLETA do Mercado Pago:');
                console.log(JSON.stringify(resultado, null, 2));

                // Verificar se foi criado com sucesso
                if (!resultado.id) {
                    console.log('❌ Pagamento não foi criado - sem ID');
                    return res.status(500).json({
                        error: 'Falha ao criar pagamento',
                        response: resultado
                    });
                }

                console.log('✅ Pagamento criado - ID:', resultado.id);
                console.log('📊 Status:', resultado.status);

                // Montar resposta
                const resposta = {
                    id: resultado.id,
                    status: resultado.status,
                    payment_method_id: resultado.payment_method_id,
                    external_reference: resultado.external_reference,
                    date_created: resultado.date_created,
                    date_of_expiration: resultado.date_of_expiration,
                    debug_info: {
                        has_point_of_interaction: !!resultado.point_of_interaction,
                        has_transaction_data: !!resultado.point_of_interaction?.transaction_data,
                        has_qr_code: !!resultado.point_of_interaction?.transaction_data?.qr_code,
                        all_keys: Object.keys(resultado)
                    }
                };

                // Extrair QR Code REAL - verificar múltiplos locais
                console.log('🔍 PROCURANDO QR Code...');
                
                if (resultado.point_of_interaction?.transaction_data?.qr_code) {
                    resposta.qr_code = resultado.point_of_interaction.transaction_data.qr_code;
                    resposta.qr_code_base64 = resultado.point_of_interaction.transaction_data.qr_code_base64;
                    
                    console.log('✅ QR Code encontrado em point_of_interaction.transaction_data');
                    console.log('🔑 QR Code (primeiros 50 chars):', resposta.qr_code.substring(0, 50));
                    console.log('📏 Tamanho do QR Code:', resposta.qr_code.length);
                    
                } else if (resultado.qr_code) {
                    resposta.qr_code = resultado.qr_code;
                    console.log('✅ QR Code encontrado em resultado.qr_code');
                    
                } else if (resultado.transaction_data?.qr_code) {
                    resposta.qr_code = resultado.transaction_data.qr_code;
                    console.log('✅ QR Code encontrado em transaction_data.qr_code');
                    
                } else {
                    console.log('❌ QR Code NÃO encontrado em lugar nenhum!');
                    console.log('🔍 Estrutura point_of_interaction:', resultado.point_of_interaction);
                    
                    // Retornar erro específico
                    return res.status(500).json({
                        error: 'QR Code não gerado pelo Mercado Pago',
                        payment_id: resultado.id,
                        status: resultado.status,
                        debug: {
                            point_of_interaction: resultado.point_of_interaction,
                            all_keys: Object.keys(resultado)
                        }
                    });
                }

                console.log('🎉 SUCESSO - Retornando PIX real');
                return res.status(200).json(resposta);

            } catch (mpError) {
                console.error('💥 ERRO específico do Mercado Pago:', mpError);
                console.error('📊 Stack MP:', mpError.stack);
                console.error('📝 Message MP:', mpError.message);
                
                // Verificar se é erro de validação
                if (mpError.cause && Array.isArray(mpError.cause)) {
                    console.error('🔴 Erros de validação:', mpError.cause);
                    return res.status(400).json({
                        error: 'Erro de validação do Mercado Pago',
                        details: mpError.cause,
                        message: mpError.message
                    });
                }

                // Erro de importação ou configuração
                if (mpError.message.includes('Cannot resolve')) {
                    console.error('📦 Erro de importação do SDK');
                    return res.status(500).json({
                        error: 'SDK do Mercado Pago não encontrado',
                        suggestion: 'Verifique se a dependência está instalada'
                    });
                }

                return res.status(500).json({
                    error: 'Erro interno do Mercado Pago',
                    message: mpError.message,
                    type: mpError.name
                });
            }

        } else {
            // Outros métodos
            console.log('💳 Método não é PIX:', payment_method_id);
            return res.status(200).json({
                id: 'test_' + Date.now(),
                status: 'pending',
                payment_method_id: payment_method_id,
                message: 'Método simulado'
            });
        }

    } catch (error) {
        console.error('💥 ERRO GERAL:', error);
        console.error('📊 Stack geral:', error.stack);
        
        return res.status(500).json({
            error: 'Erro interno do servidor',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}