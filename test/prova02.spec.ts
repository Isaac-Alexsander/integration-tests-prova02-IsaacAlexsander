import pactum from 'pactum';
import { StatusCodes } from 'http-status-codes';
import { SimpleReporter } from '../simple-reporter';

const p = pactum;
const rep = SimpleReporter;
const baseUrl = 'https://api-prova02-isaacalexsander.onrender.com';

p.request.setDefaultTimeout(30000);

beforeAll(async () => {
  p.reporter.add(rep);
  await p.spec().get(`${baseUrl}/health`).withRequestTimeout(60000).expectStatus(StatusCodes.OK);
}, 60000);

afterAll(() => p.reporter.end());

const itemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    nome: { type: 'string' },
    categoria: { type: 'string' },
    preco: { type: 'number' },
    quantidade: { type: 'number' }
  },
  required: ['id', 'nome', 'categoria', 'preco', 'quantidade']
};

describe('Cenário: Consulta de itens', () => {
  it('deve listar os itens retornando o envelope items, total, skip e limit', async () => {
    await p
      .spec()
      .get(`${baseUrl}/items`)
      .expectStatus(StatusCodes.OK)
      .expectJsonSchema({
        type: 'object',
        properties: {
          items: { type: 'array', items: itemSchema },
          total: { type: 'number' },
          skip: { type: 'number' },
          limit: { type: 'number' }
        },
        required: ['items', 'total', 'skip', 'limit']
      });
  });

  it('deve retornar o item correspondente ao buscar por um id existente', async () => {
    await p
      .spec()
      .get(`${baseUrl}/items/{id}`)
      .withPathParams('id', 1)
      .expectStatus(StatusCodes.OK)
      .expectJsonLike({ id: 1 })
      .expectJsonSchema(itemSchema);
  });
});

describe('Cenário: Paginação e filtros', () => {
  it('deve retornar exatamente a quantidade de itens definida pelo parâmetro limit', async () => {
    const items = await p
      .spec()
      .get(`${baseUrl}/items`)
      .withQueryParams({ limit: 4, skip: 0 })
      .expectStatus(StatusCodes.OK)
      .expectJsonLike({ limit: 4, skip: 0 })
      .returns('items');

    expect(items).toHaveLength(4);
  });

  it('deve pular os primeiros itens de acordo com o parâmetro skip', async () => {
    const primeiroItem = await p
      .spec()
      .get(`${baseUrl}/items`)
      .withQueryParams({ limit: 1, skip: 0 })
      .expectStatus(StatusCodes.OK)
      .returns('items[0].id');

    const itemDeslocado = await p
      .spec()
      .get(`${baseUrl}/items`)
      .withQueryParams({ limit: 1, skip: 3 })
      .expectStatus(StatusCodes.OK)
      .returns('items[0].id');

    expect(itemDeslocado).not.toBe(primeiroItem);
  });

  it('deve combinar limit e skip retornando o subconjunto correto de itens', async () => {
    const items = await p
      .spec()
      .get(`${baseUrl}/items`)
      .withQueryParams('limit', 2)
      .withQueryParams('skip', 4)
      .expectStatus(StatusCodes.OK)
      .expectJsonLike({ limit: 2, skip: 4 })
      .returns('items');

    expect(items).toHaveLength(2);
  });

  it('deve limitar os itens retornados ao total disponível quando o limit for maior que o total', async () => {
    const body = await p
      .spec()
      .get(`${baseUrl}/items`)
      .withQueryParams({ limit: 9999, skip: 0 })
      .expectStatus(StatusCodes.OK)
      .returns((ctx) => ctx.res.json);

    expect(body.items).toHaveLength(body.total);
  });
});

describe('Cenário: Criação de item', () => {
  it('deve criar um item e retornar os dados enviados acrescidos de um id numérico', async () => {
    const payload = {
      nome: 'Item Cenário Criação',
      categoria: 'Prova',
      preco: 75.3,
      quantidade: 4
    };

    await p
      .spec()
      .post(`${baseUrl}/items`)
      .withJson(payload)
      .expectStatus(StatusCodes.CREATED)
      .expectJsonLike(payload)
      .expectJsonSchema(itemSchema)
      .stores('ItemCriadoId', 'id');
  });

  it('deve manter o item criado disponível para consulta imediata pelo id gerado', async () => {
    await p
      .spec()
      .get(`${baseUrl}/items/{id}`)
      .withPathParams('id', '$S{ItemCriadoId}')
      .expectStatus(StatusCodes.OK)
      .expectJsonLike({ nome: 'Item Cenário Criação' });
  });

  it('deve retornar 400 e uma lista de erros ao enviar payload sem os campos obrigatórios', async () => {
    await p
      .spec()
      .post(`${baseUrl}/items`)
      .withJson({ nome: 'Item sem os demais campos' })
      .expectStatus(StatusCodes.BAD_REQUEST)
      .expectJsonSchema({
        type: 'object',
        properties: { message: { type: 'string' }, errors: { type: 'array' } },
        required: ['message', 'errors']
      });
  });

  it('deve rejeitar a criação de um item com quantidade negativa', async () => {
    await p
      .spec()
      .post(`${baseUrl}/items`)
      .withJson({ nome: 'Item inválido', categoria: 'Prova', preco: 10, quantidade: -5 })
      .expectStatus(StatusCodes.BAD_REQUEST);
  });
});

describe('Cenário: Atualização de item', () => {
  const itemBase = { nome: 'Item Cenário Atualização', categoria: 'Prova', preco: 200, quantidade: 12 };

  it('deve alterar apenas o campo enviado no PUT e preservar os demais campos do item', async () => {
    await p.spec().post(`${baseUrl}/items`).withJson(itemBase).expectStatus(StatusCodes.CREATED).stores('ItemAtualizadoId', 'id');

    await p
      .spec()
      .put(`${baseUrl}/items/{id}`)
      .withPathParams('id', '$S{ItemAtualizadoId}')
      .withJson({ preco: 349.9 })
      .expectStatus(StatusCodes.OK)
      .expectJsonLike({ ...itemBase, preco: 349.9 });
  });

  it('deve retornar 404 ao tentar atualizar um item com id inexistente', async () => {
    await p
      .spec()
      .put(`${baseUrl}/items/{id}`)
      .withPathParams('id', 999999)
      .withJson({ quantidade: 1 })
      .expectStatus(StatusCodes.NOT_FOUND);
  });

  it('deve rejeitar a atualização quando o campo preco é enviado com tipo inválido', async () => {
    await p
      .spec()
      .put(`${baseUrl}/items/{id}`)
      .withPathParams('id', '$S{ItemAtualizadoId}')
      .withJson({ preco: 'muito caro' })
      .expectStatus(StatusCodes.BAD_REQUEST);
  });
});

describe('Cenário: Tratamento de erros e contrato', () => {
  it('deve retornar 404 ao tentar excluir um item inexistente', async () => {
    await p.spec().delete(`${baseUrl}/items/{id}`).withPathParams('id', 999999).expectStatus(StatusCodes.NOT_FOUND);
  });

  it('deve retornar 404 para uma rota que não existe na API', async () => {
    await p.spec().get(`${baseUrl}/rota-que-nao-existe`).expectStatus(StatusCodes.NOT_FOUND);
  });

  it('deve responder a listagem de itens com o cabeçalho content-type em JSON', async () => {
    await p.spec().get(`${baseUrl}/items`).expectStatus(StatusCodes.OK).expectHeaderContains('content-type', 'application/json');
  });

  it('deve responder dentro de um tempo aceitável mesmo em um cenário de erro', async () => {
    await p
      .spec()
      .get(`${baseUrl}/items/{id}`)
      .withPathParams('id', 999999)
      .expectStatus(StatusCodes.NOT_FOUND)
      .expectResponseTime(3000);
  });
});
