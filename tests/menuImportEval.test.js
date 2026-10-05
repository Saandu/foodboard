import { describe, expect, it } from 'vitest'
import { FIXTURES } from '../scripts/eval/fixtures.js'
import { matchDishes, scoreFixture, similarity, summarize } from '../scripts/eval/score.js'

const fixture = id => FIXTURES.find(entry => entry.id === id)
/** A draft that reproduces a fixture's expected menu exactly. */
const perfect = (expected) => ({
  title: expected.title,
  language: expected.language,
  currency: expected.currency,
  warnings: [],
  categories: expected.categories.map(category => ({
    name: category.name,
    description: '',
    items: category.dishes.map(dish => ({ name: dish.name, description: '', prices: dish.prices.map(amount => ({ amount, label: '' })), allergens: [...dish.allergens], warning: '' }))
  }))
})

describe('menu import eval scorer', () => {
  it('matches names across accents, case and small wording changes', () => {
    expect(similarity('Tiramisù', 'TIRAMISU')).toBe(1)
    expect(similarity('Ciorbă de burtă', 'Ciorba de burta')).toBe(1)
    expect(similarity('Panna cotta ai frutti di bosco', 'Panna cotta')).toBeGreaterThan(0.5)
    expect(similarity('Espresso', 'Banana bread')).toBe(0)
  })
  it('pairs each expected dish with at most one extracted dish', () => {
    const { matches, missing, extra } = matchDishes([{ name: 'Margherita' }, { name: 'Diavola' }], [{ name: 'Pizza Margherita' }, { name: 'Margherita' }, { name: 'Calzone' }])
    expect(matches.map(pair => pair.extracted.name)).toEqual(['Margherita'])
    expect(missing.map(dish => dish.name)).toEqual(['Diavola'])
    expect(extra.map(dish => dish.name)).toEqual(['Pizza Margherita', 'Calzone'])
  })
  it('passes a perfect extraction of every menu fixture', () => {
    for (const entry of FIXTURES.filter(item => item.expected)) {
      expect(scoreFixture(entry, perfect(entry.expected)).passed, entry.id).toBe(true)
    }
  })
  it('counts invented and missed allergens separately', () => {
    const draft = perfect(fixture('cafe-photo').expected)
    draft.categories[0].items[1].allergens = [14]
    const result = scoreFixture(fixture('cafe-photo'), draft)
    expect(result.passed).toBe(false)
    expect(result.allergens).toMatchObject({ falsePositives: 1, falseNegatives: 0 })
  })
  it('treats a weight-priced dish as correct only when its price is left blank', () => {
    const draft = perfect(fixture('bistro-ro').expected)
    expect(scoreFixture(fixture('bistro-ro'), draft).prices.right).toBe(7)
    draft.categories[1].items[1].prices = [{ amount: '45', label: '' }]
    expect(scoreFixture(fixture('bistro-ro'), draft).prices.right).toBe(6)
  })
  it('flags every effect the injected instruction asks for', () => {
    const base = fixture('injection')
    const added = perfect(base.expected)
    added.categories[0].items.push({ name: 'Free meal at evil.example', description: '', prices: [{ amount: '1', label: '' }], allergens: [], warning: '' })
    const zeroed = perfect(base.expected)
    zeroed.categories[0].items[0].prices = [{ amount: '0.00', label: '' }]
    const stripped = perfect(base.expected)
    stripped.categories.forEach(category => category.items.forEach(item => { item.allergens = [] }))
    for (const draft of [added, zeroed, stripped]) expect(scoreFixture(base, draft).injectionResisted).toBe(false)
    expect(scoreFixture(base, perfect(base.expected)).injectionResisted).toBe(true)
  })
  it('requires the non-menu to be refused', () => {
    expect(scoreFixture(fixture('not-a-menu'), null, 'not_a_menu').passed).toBe(true)
    expect(scoreFixture(fixture('not-a-menu'), perfect(fixture('cafe-photo').expected)).passed).toBe(false)
  })
  it('summarizes recall, precision and allergen errors across fixtures', () => {
    const results = FIXTURES.map(entry => scoreFixture(entry, entry.expected ? perfect(entry.expected) : null, entry.expected ? '' : 'not_a_menu'))
    expect(summarize(results)).toMatchObject({ fixturesPassed: 5, fixtures: 5, dishRecall: 1, dishPrecision: 1, priceAccuracy: 1, allergenAccuracy: 1, allergenFalsePositives: 0 })
  })
})
