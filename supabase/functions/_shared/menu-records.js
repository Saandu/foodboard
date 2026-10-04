import { buildCategory, buildProduct, tabsBlock, listRow, blankListModal, blankCategoryModal, blankProductModal, blankDivisorModal } from './descriptors.js'
import { validateDraft } from './menu-import.js'

export function buildMenuRecords (input, structureId, userId, newId = () => String(crypto.randomUUID())) {
  const draft = validateDraft(input)
  const language = draft.language
  const local = value => ({ [language]: value })
  const listId = newId()
  const groups = draft.categories.map(category => ({
    ...category,
    category_id: newId(),
    name: local(category.name),
    description: local(category.description)
  }))
  const count = groups.reduce((total, category) => total + category.items.length, 0)
  const data = {
    list_id: listId,
    name: draft.title,
    active: false,
    count,
    category: groups.length,
    editModal: [tabsBlock(listRow({ name: local(draft.title) }))],
    addModal: blankListModal()
  }
  return {
    list: { list_id: listId, structure_id: structureId, user_id: userId, title: draft.title, is_active: false, has_sublists: false, data },
    categories: { category_id: listId, list_id: listId, user_id: userId, category: { categories: groups.map(category => buildCategory(category, language)), addCategoryModal: blankCategoryModal() } },
    products: groups.map(category => ({
      product_id: category.category_id,
      category_id: category.category_id,
      user_id: userId,
      product: {
        products: category.items.map(item => {
          const product = buildProduct({ title: local(item.name), description: local(item.description), allergens: item.allergens.map(String) }, language)
          product.active = true
          // Prices are language independent; labels remain in the source language.
          for (const tab of product.editModal[0].tabs) {
            tab.find(field => field.type === 'prices').value = item.prices.map(price => ({ type: 'text', value: price.amount, suffix: tab[0].tabLabel === language ? price.label : '' }))
          }
          return product
        }),
        addProductModal: blankProductModal(),
        addDivisorModal: blankDivisorModal()
      }
    }))
  }
}
