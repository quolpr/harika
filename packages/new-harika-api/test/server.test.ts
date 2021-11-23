import typeorm = require('typeorm');

const products = [
	{
		_id: '5f2678dff22e1f4a3c0782ee',
		name: 'JBL Headphone',
		category: 'Electronic appliances',
		unit: 1,
	}
];

const dbMock = {
	Product: {
		find: jest.fn().mockReturnValue(products),
		findOne: jest.fn().mockReturnValue(products[0]),
		save: jest.fn().mockReturnValue(products[0]),
		remove: jest.fn(),
	},
};

typeorm.createConnection = jest.fn().mockReturnValue({
	getRepository: (model) => dbMock[model.name],
});

typeorm.getConnectionOptions = jest.fn().mockReturnValue({});

describe('Server', () => {
	let server;

	beforeEach(async () => {
		server = await require('../src/index');
		await server.ready();
	});

	afterAll(() => server.close());

	test('/health returns ok', (done) => {
		server.inject(
			{
				method: 'GET',
				url: '/health',
			},
			(err, res) => {
				expect(res.statusCode).toBe(200);
				expect(JSON.parse(res.payload)).toEqual({ status: 'ok' });
				done(err);
			}
		);
	});

	test('GET /product/:_id returns one of product by _id', (done) => {
		server.inject(
			{
				method: 'GET',
				url: `/product/${products[0]._id}`,
			},
			(err, res) => {
				expect(res.statusCode).toBe(200);
				expect(dbMock.Product.findOne).toHaveBeenCalledWith(products[0]._id);
				expect(JSON.parse(res.payload)).toEqual(products[0]);
				done(err);
			}
		);
	});

	test('GET /product returns list of products', (done) => {
		server.inject(
			{
				method: 'GET',
				url: '/product',
			},
			(err, res) => {
				expect(res.statusCode).toBe(200);
				expect(dbMock.Product.find).toHaveBeenCalledWith();
				expect(JSON.parse(res.payload)[0]).toEqual(products[0]);
				done(err);
			}
		);
	});

	test('Add Product POST /product', async (done) => {
		const res = await server.inject({
			method: 'POST',
			url: '/product',
			payload: {
				_id: '5f2678dff22e1f4a3c9992ee',
				name: 'Apple Headphone',
				category: 'Electronic appliances',
				unit: 2
			}
		});
		expect(res.statusCode).toBe(201);
		done();
	});

	test('Update Product POST /product/:id', async (done) => {
		const res = await server.inject({
			method: 'PUT',
			url: '/product/5f2678dff22e1f4a3c0782ee',
			payload: {
				unit: 2
			}
		});
		expect(res.statusCode).toBe(200);
		done();
	});

	test('DELETE /product/:id deletes a product', (done) => {
		const { _id } = products[0];
		server.inject(
			{
				method: 'DELETE',
				url: `/product/${_id}`,
			},
			(err, res) => {
				expect(res.statusCode).toBe(200);
				expect(dbMock.Product.findOne).toHaveBeenCalledWith(_id);
				expect(dbMock.Product.remove).toHaveBeenCalledWith(products[0]);
				done(err);
			}
		);
	});
});
