import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/handlers/hello';

const event = (qs: Record<string, string> | null): APIGatewayProxyEvent =>
  ({ queryStringParameters: qs }) as unknown as APIGatewayProxyEvent;

describe('hello handler', () => {
  it('greets world by default', async () => {
    const res = await handler(event(null));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Hello, world!');
  });

  it('greets by name', async () => {
    const res = await handler(event({ name: 'CDK' }));
    expect(JSON.parse(res.body).message).toBe('Hello, CDK!');
  });
});
