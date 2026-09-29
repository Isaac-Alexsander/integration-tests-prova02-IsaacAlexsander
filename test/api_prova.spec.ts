import pactum from 'pactum';
import { StatusCodes } from 'http-status-codes';
import { SimpleReporter } from '../simple-reporter';

describe('API Prova - Isaac Alexsander', () => {
  const p = pactum;
  const rep = SimpleReporter;
  const baseUrl = 'https://api-prova02-isaacalexsander.onrender.com';

  p.request.setDefaultTimeout(30000);

  beforeAll(async () => {
    p.reporter.add(rep);
    await p.spec().get(`${baseUrl}/health`).withRequestTimeout(60000).expectStatus(StatusCodes.OK);
  }, 60000);

  afterAll(() => p.reporter.end());

  describe('GET /items', () => {
    it('lista os itens com o envelope items/total/skip/limit', async () => {
      await p
        .spec()
        .get(`${baseUrl}/items`)
        .expectStatus(StatusCodes.OK)
        .expectJsonSchema({
          type: 'object',
          properties: {
            items: { type: 'array' },
            total: { type: 'number' },
            skip: { type: 'number' },
            limit: { type: 'number' }
          },
          required: ['items', 'total', 'skip', 'limit']
        });
    });

    it('respeita limit e skip na paginação', async () => {
      const body = await p
        .spec()
        .get(`${baseUrl}/items`)
        .withQueryParams({ limit: 5, skip: 2 })
        .expectStatus(StatusCodes.OK)
        .returns((ctx) => ctx.res.json);

      expect(body.items).toHaveLength(5);
      expect(body.limit).toBe(5);
      expect(body.skip).toBe(2);
    });

    it('busca um item existente por id', async () => {
      await p.spec().get(`${baseUrl}/items/1`).expectStatus(StatusCodes.OK).expectJsonLike({ id: 1 });
    });

    it('retorna 404 com mensagem para id inexistente', async () => {
      await p
        .spec()
        .get(`${baseUrl}/items/999999`)
        .expectStatus(StatusCodes.NOT_FOUND)
        .expectJsonSchema({
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message']
        });
    });

    it('responde dentro de um tempo aceitável', async () => {
      await p.spec().get(`${baseUrl}/items`).expectStatus(StatusCodes.OK).expectResponseTime(3000);
    });
  });

  describe('POST /items', () => {
    it('cria um item válido e retorna o item criado com id', async () => {
      const payload = {
        nome: 'Item de Teste Automatizado',
        categoria: 'Testes',
        preco: 42.5,
        quantidade: 7
      };

      await p
        .spec()
        .post(`${baseUrl}/items`)
        .withJson(payload)
        .expectStatus(StatusCodes.CREATED)
        .expectJsonLike(payload)
        .expectJsonSchema({
          type: 'object',
          properties: { id: { type: 'number' } },
          required: ['id']
        });
    });

    it('retorna 400 ao enviar payload sem os campos obrigatórios', async () => {
      await p
        .spec()
        .post(`${baseUrl}/items`)
        .withJson({ nome: 'Item incompleto' })
        .expectStatus(StatusCodes.BAD_REQUEST)
        .expectJsonSchema({
          type: 'object',
          properties: { message: { type: 'string' }, errors: { type: 'array' } },
          required: ['message', 'errors']
        });
    });
  });

  describe('PUT /items/:id', () => {
    it('atualiza um campo e preserva os demais campos do item', async () => {
      const created = await p
        .spec()
        .post(`${baseUrl}/items`)
        .withJson({ nome: 'Item para PUT', categoria: 'Testes', preco: 100, quantidade: 10 })
        .expectStatus(StatusCodes.CREATED)
        .returns((ctx) => ctx.res.json);

      await p
        .spec()
        .put(`${baseUrl}/items/${created.id}`)
        .withJson({ quantidade: 999 })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          id: created.id,
          nome: created.nome,
          categoria: created.categoria,
          preco: created.preco,
          quantidade: 999
        });
    });

    it('retorna 404 ao atualizar um id inexistente', async () => {
      await p.spec().put(`${baseUrl}/items/999999`).withJson({ quantidade: 1 }).expectStatus(StatusCodes.NOT_FOUND);
    });
  });

  describe('Fluxo: criar via POST e buscar de volta via GET', () => {
    it('cria um item e o encontra em seguida pelo id retornado', async () => {
      const payload = {
        nome: 'Item Fluxo Completo',
        categoria: 'Fluxo',
        preco: 15.9,
        quantidade: 3
      };

      const created = await p
        .spec()
        .post(`${baseUrl}/items`)
        .withJson(payload)
        .expectStatus(StatusCodes.CREATED)
        .returns((ctx) => ctx.res.json);

      await p.spec().get(`${baseUrl}/items/${created.id}`).expectStatus(StatusCodes.OK).expectJsonLike(payload);
    });
  });
});
