import { describeAlert } from './alert.reply';

describe('describeAlert', () => {
  it('stores a sell watch that has not been reached', () => {
    const reply = describeAlert({
      name: 'Bolsa del iniciado',
      city: 'Martlock',
      side: 'sell',
      target: 13000,
      current: 15000,
      replaced: false,
    });
    expect(reply.save).toBe(true);
    expect(reply.title).toBe('Aviso guardado');
    expect(reply.description).toContain('baje a 13.000');
    expect(reply.description).toContain('15.000');
  });

  it('does not store a sell watch that is already cheap enough', () => {
    const reply = describeAlert({
      name: 'Bolsa',
      city: 'Martlock',
      side: 'sell',
      target: 13000,
      current: 12000,
      replaced: false,
    });
    expect(reply.save).toBe(false);
    expect(reply.description).toContain('No guardé el aviso');
    expect(reply.description).toContain('12.000');
  });

  it('stores a buy watch and says when the previous one was replaced', () => {
    const reply = describeAlert({
      name: 'Bolsa',
      city: 'Caerleon',
      side: 'buy',
      target: 14000,
      current: null,
      replaced: true,
    });
    expect(reply.save).toBe(true);
    expect(reply.title).toBe('Aviso actualizado');
    expect(reply.description).toContain('suba a 14.000');
    expect(reply.description).toContain('Todavía no hay compra');
  });
});
