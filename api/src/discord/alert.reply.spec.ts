import { bestAlertHit, describeAlert } from './alert.reply';

describe('describeAlert', () => {
  it('stores an open sell watch that has not been reached', () => {
    const reply = describeAlert({
      name: 'Bolsa del iniciado',
      side: 'sell',
      target: 13000,
      scope: {},
      hit: null,
      replaced: false,
    });
    expect(reply.save).toBe(true);
    expect(reply.title).toBe('Aviso guardado');
    expect(reply.description).toBe(
      'Te aviso en este canal cuando la venta de Bolsa del iniciado baje a 13.000 o menos.',
    );
  });

  it('does not store a watch that a city already meets', () => {
    const reply = describeAlert({
      name: 'Bolsa',
      side: 'sell',
      target: 13000,
      scope: {},
      hit: { city: 'Martlock', quality: 1, enchantment: 0, price: 12000 },
      replaced: false,
    });
    expect(reply.save).toBe(false);
    expect(reply.description).toContain('Martlock, Normal, encantamiento 0');
    expect(reply.description).toContain('12.000');
    expect(reply.description).toContain('No guardé el aviso');
  });

  it('names only the filters the user set', () => {
    const reply = describeAlert({
      name: 'Bolsa',
      side: 'buy',
      target: 14000,
      scope: { city: 'Caerleon', quality: 2 },
      hit: null,
      replaced: true,
    });
    expect(reply.title).toBe('Aviso actualizado');
    expect(reply.description).toContain('en Caerleon, Buena');
    expect(reply.description).not.toContain('encantamiento');
  });
});

describe('bestAlertHit', () => {
  it('picks the cheapest sell that is already at the target', () => {
    const hit = bestAlertHit(
      [
        { city: 'Caerleon', quality: 1, enchantment: 0, sellMin: 9000, buyMax: null },
        { city: 'Martlock', quality: 3, enchantment: 2, sellMin: 8000, buyMax: null },
        { city: 'Lymhurst', quality: 1, enchantment: 0, sellMin: 20000, buyMax: null },
      ],
      'sell',
      10000,
    );
    expect(hit).toEqual({
      city: 'Martlock',
      quality: 3,
      enchantment: 2,
      price: 8000,
    });
  });
});