/**
 * Demo content for the public FoodBoard showcase.
 *
 * This file is deliberately written in a flat, readable shape — one entry per
 * dish, translations grouped together — rather than in the nested JSONB shape
 * the database actually stores. `seed.js` does the translation between the two,
 * so editing the menu here does not require understanding the storage format.
 *
 * Localised fields are objects keyed by language code. Any language left out
 * falls back to the structure's main language in the customer-facing menu.
 */

/** Allergen ids, matching the list rendered in the admin panel. */
export const ALLERGEN = {
  MOLLUSCS: '1',
  FISH: '2',
  SESAME: '3',
  SOY: '4',
  CRUSTACEANS: '5',
  GLUTEN: '6',
  LUPIN: '7',
  CELERY: '8',
  SULPHITES: '9',
  MUSTARD: '10',
  EGGS: '11',
  PEANUTS: '12',
  NUTS: '13',
  MILK: '14'
}

export const demoUser = {
  user_id: '1',
  name: 'Alessandro',
  surname: 'Lombardi'
}

export const demoStructures = [
  {
    structure_id: '111',
    public_slug: 'trattoria-mareluna',
    title: 'Trattoria Mareluna',
    languages: ['it', 'en', 'ro'],
    language_main: 'it',
    currency: '€',
    color_main: '#2f4f43',
    color_background: '#ffffff',
    contact: {
      address: 'Via San Marco 12, Milano',
      phone: '+39 02 0000 1111',
      email: 'ciao@mareluna.example',
      website: 'https://mareluna.example',
      instagram: 'mareluna.demo'
    },
    profile: {
      it: 'Ristorante & Enoteca',
      en: 'Restaurant & Wine Bar',
      ro: 'Restaurant & Vinotecă'
    },
    description: {
      it: 'Cucina di mare e di terra nel cuore di Milano, con una cantina di piccoli produttori italiani.',
      en: 'Sea and land cooking in the heart of Milan, with a cellar of small Italian producers.',
      ro: 'Bucătărie de pește și de uscat în inima Milanului, cu o pivniță de mici producători italieni.'
    },

    lists: [
      {
        list_id: '1111',
        active: true,
        name: { it: 'Menù della Sera', en: 'Dinner Menu', ro: 'Meniu de Seară' },
        categories: [
          {
            category_id: '11111',
            name: { it: 'Antipasti', en: 'Starters', ro: 'Antreuri' },
            description: {
              it: 'Da condividere, o da tenere tutto per sé.',
              en: 'To share, or to keep all to yourself.',
              ro: 'De împărțit, sau de păstrat doar pentru tine.'
            },
            items: [
              {
                type: 'divisor',
                title: { it: 'Dal Mare', en: 'From the Sea', ro: 'Din Mare' }
              },
              {
                title: { it: 'Crudo di Ricciola', en: 'Amberjack Crudo', ro: 'Crudo de Ricciola' },
                description: {
                  it: 'Ricciola cruda, agrumi di Sicilia, olio extravergine e finocchietto selvatico',
                  en: 'Raw amberjack, Sicilian citrus, extra virgin olive oil and wild fennel',
                  ro: 'Pește ricciola crud, citrice siciliene, ulei extravirgin și fenicul sălbatic'
                },
                price: '18.00',
                allergens: [ALLERGEN.FISH]
              },
              {
                title: { it: 'Cozze alla Marinara', en: 'Mussels Marinara', ro: 'Midii Marinara' },
                description: {
                  it: 'Cozze di Olbia, pomodorino, prezzemolo e crostone di pane casereccio',
                  en: 'Olbia mussels, cherry tomato, parsley and a slice of toasted country bread',
                  ro: 'Midii de Olbia, roșii cherry, pătrunjel și felie de pâine de casă prăjită'
                },
                price: '14.00',
                allergens: [ALLERGEN.MOLLUSCS, ALLERGEN.GLUTEN]
              },
              {
                type: 'divisor',
                title: { it: 'Dalla Terra', en: 'From the Land', ro: 'De pe Uscat' }
              },
              {
                title: { it: 'Burrata e Pomodorini Confit', en: 'Burrata & Confit Tomatoes', ro: 'Burrata cu Roșii Confit' },
                description: {
                  it: 'Burrata pugliese, pomodorini confit, basilico e olio al limone',
                  en: 'Apulian burrata, confit cherry tomatoes, basil and lemon oil',
                  ro: 'Burrata din Puglia, roșii cherry confit, busuioc și ulei de lămâie'
                },
                price: '13.00',
                allergens: [ALLERGEN.MILK]
              },
              {
                title: { it: 'Vitello Tonnato', en: 'Vitello Tonnato', ro: 'Vitello Tonnato' },
                description: {
                  it: 'Girello di vitello, salsa tonnata classica e capperi di Pantelleria',
                  en: 'Veal round, classic tuna sauce and Pantelleria capers',
                  ro: 'Mușchi de vițel, sos clasic de ton și capere de Pantelleria'
                },
                price: '15.00',
                allergens: [ALLERGEN.FISH, ALLERGEN.EGGS]
              }
            ]
          },
          {
            category_id: '11112',
            name: { it: 'Primi', en: 'Pasta & Risotto', ro: 'Paste și Risotto' },
            description: {
              it: 'Pasta fresca tirata ogni mattina in casa.',
              en: 'Fresh pasta rolled in house every morning.',
              ro: 'Paste proaspete, întinse în casă în fiecare dimineață.'
            },
            items: [
              {
                title: { it: 'Spaghetti allo Scoglio', en: 'Seafood Spaghetti', ro: 'Spaghete cu Fructe de Mare' },
                description: {
                  it: 'Spaghetti di Gragnano, cozze, vongole, gamberi e pomodorino fresco',
                  en: 'Gragnano spaghetti, mussels, clams, prawns and fresh cherry tomato',
                  ro: 'Spaghete de Gragnano, midii, scoici, creveți și roșii cherry proaspete'
                },
                price: '22.00',
                allergens: [ALLERGEN.MOLLUSCS, ALLERGEN.CRUSTACEANS, ALLERGEN.GLUTEN]
              },
              {
                title: { it: 'Risotto ai Porcini', en: 'Porcini Risotto', ro: 'Risotto cu Hribi' },
                description: {
                  it: 'Carnaroli, porcini freschi, burro di malga e Parmigiano 24 mesi',
                  en: 'Carnaroli rice, fresh porcini, alpine butter and 24-month Parmigiano',
                  ro: 'Orez Carnaroli, hribi proaspeți, unt de munte și Parmigiano de 24 de luni'
                },
                price: '19.00',
                allergens: [ALLERGEN.MILK]
              },
              {
                title: { it: 'Tagliatelle al Ragù di Cinghiale', en: 'Tagliatelle with Wild Boar Ragù', ro: 'Tagliatelle cu Ragù de Mistreț' },
                description: {
                  it: 'Tagliatelle all\'uovo, ragù di cinghiale cotto otto ore, rosmarino',
                  en: 'Egg tagliatelle, wild boar ragù slow-cooked for eight hours, rosemary',
                  ro: 'Tagliatelle cu ou, ragù de mistreț gătit opt ore, rozmarin'
                },
                price: '18.00',
                allergens: [ALLERGEN.GLUTEN, ALLERGEN.EGGS, ALLERGEN.CELERY]
              },
              {
                title: { it: 'Gnocchi al Pesto Genovese', en: 'Gnocchi with Genovese Pesto', ro: 'Gnocchi cu Pesto Genovez' },
                description: {
                  it: 'Gnocchi di patate, pesto al mortaio, fagiolini e patate novelle',
                  en: 'Potato gnocchi, mortar-pounded pesto, green beans and new potatoes',
                  ro: 'Gnocchi de cartofi, pesto pisat în piuă, fasole verde și cartofi noi'
                },
                price: '16.00',
                allergens: [ALLERGEN.GLUTEN, ALLERGEN.NUTS, ALLERGEN.MILK]
              }
            ]
          },
          {
            category_id: '11113',
            name: { it: 'Secondi', en: 'Main Courses', ro: 'Feluri Principale' },
            description: {
              it: 'Pesce del giorno dal mercato, carni da allevamenti selezionati.',
              en: 'Fish of the day from the market, meat from selected farms.',
              ro: 'Peștele zilei din piață, carne de la ferme selectate.'
            },
            items: [
              {
                title: { it: 'Branzino in Crosta di Sale', en: 'Sea Bass in Salt Crust', ro: 'Biban de Mare în Crustă de Sare' },
                description: {
                  it: 'Branzino intero cotto al sale, verdure di stagione ed emulsione al limone',
                  en: 'Whole sea bass baked in salt, seasonal vegetables and lemon emulsion',
                  ro: 'Biban de mare întreg copt în sare, legume de sezon și emulsie de lămâie'
                },
                price: '26.00',
                allergens: [ALLERGEN.FISH]
              },
              {
                title: { it: 'Tagliata di Manzo', en: 'Sliced Beef Sirloin', ro: 'Tagliata de Vită' },
                description: {
                  it: 'Controfiletto di scottona, rucola, scaglie di Grana e riduzione al Barolo',
                  en: 'Heifer sirloin, rocket, Grana shavings and Barolo reduction',
                  ro: 'Antricot de junincă, rucola, fulgi de Grana și reducție de Barolo'
                },
                price: '28.00',
                allergens: [ALLERGEN.MILK, ALLERGEN.SULPHITES]
              },
              {
                title: { it: 'Polpo alla Griglia', en: 'Grilled Octopus', ro: 'Caracatiță la Grătar' },
                description: {
                  it: 'Polpo scottato alla brace, crema di ceci e olio al prezzemolo',
                  en: 'Char-grilled octopus, chickpea cream and parsley oil',
                  ro: 'Caracatiță la jar, cremă de năut și ulei de pătrunjel'
                },
                price: '24.00',
                allergens: [ALLERGEN.MOLLUSCS]
              },
              {
                title: { it: 'Parmigiana di Melanzane', en: 'Aubergine Parmigiana', ro: 'Parmigiana de Vinete' },
                description: {
                  it: 'Melanzane, pomodoro San Marzano, fiordilatte e basilico',
                  en: 'Aubergine, San Marzano tomato, fiordilatte and basil',
                  ro: 'Vinete, roșii San Marzano, fiordilatte și busuioc'
                },
                price: '17.00',
                allergens: [ALLERGEN.MILK, ALLERGEN.GLUTEN]
              }
            ]
          },
          {
            category_id: '11114',
            name: { it: 'Dolci', en: 'Desserts', ro: 'Deserturi' },
            description: {
              it: 'Fatti in casa, tutti i giorni.',
              en: 'Made in house, every day.',
              ro: 'Făcute în casă, în fiecare zi.'
            },
            items: [
              {
                title: { it: 'Tiramisù della Casa', en: 'House Tiramisù', ro: 'Tiramisu al Casei' },
                description: {
                  it: 'Mascarpone, savoiardi inzuppati nell\'espresso e cacao amaro',
                  en: 'Mascarpone, ladyfingers soaked in espresso and bitter cocoa',
                  ro: 'Mascarpone, pișcoturi înmuiate în espresso și cacao amară'
                },
                price: '8.00',
                allergens: [ALLERGEN.GLUTEN, ALLERGEN.EGGS, ALLERGEN.MILK]
              },
              {
                title: { it: 'Panna Cotta ai Frutti di Bosco', en: 'Panna Cotta with Berries', ro: 'Panna Cotta cu Fructe de Pădure' },
                description: {
                  it: 'Panna cotta alla vaniglia con coulis di frutti di bosco',
                  en: 'Vanilla panna cotta with a wild berry coulis',
                  ro: 'Panna cotta cu vanilie și coulis de fructe de pădure'
                },
                price: '7.00',
                allergens: [ALLERGEN.MILK]
              },
              {
                title: { it: 'Cannoli Siciliani', en: 'Sicilian Cannoli', ro: 'Cannoli Sicilieni' },
                description: {
                  it: 'Cialda croccante, ricotta di pecora e pistacchio di Bronte',
                  en: 'Crisp shell, sheep\'s ricotta and Bronte pistachio',
                  ro: 'Foietaj crocant, ricotta de oaie și fistic de Bronte'
                },
                price: '8.00',
                allergens: [ALLERGEN.GLUTEN, ALLERGEN.MILK, ALLERGEN.NUTS]
              }
            ]
          },
          {
            category_id: '11115',
            name: { it: 'Cantina', en: 'Cellar', ro: 'Vinuri' },
            description: {
              it: 'Piccoli produttori italiani, serviti anche al calice.',
              en: 'Small Italian producers, also served by the glass.',
              ro: 'Mici producători italieni, serviți și la pahar.'
            },
            items: [
              {
                type: 'divisor',
                title: { it: 'Bianchi', en: 'White Wines', ro: 'Vinuri Albe' }
              },
              {
                title: { it: 'Vermentino di Gallura DOCG', en: 'Vermentino di Gallura DOCG', ro: 'Vermentino di Gallura DOCG' },
                description: {
                  it: 'Sardegna — secco, sapido, note di agrumi e macchia mediterranea',
                  en: 'Sardinia — dry and savoury, citrus and Mediterranean scrub notes',
                  ro: 'Sardinia — sec și sărat, note de citrice și tufiș mediteranean'
                },
                price: '6.00',
                priceSuffix: { it: 'al calice', en: 'per glass', ro: 'la pahar' },
                allergens: [ALLERGEN.SULPHITES]
              },
              {
                title: { it: 'Falanghina del Sannio', en: 'Falanghina del Sannio', ro: 'Falanghina del Sannio' },
                description: {
                  it: 'Campania — fresco e floreale, con un finale minerale',
                  en: 'Campania — fresh and floral, with a mineral finish',
                  ro: 'Campania — proaspăt și floral, cu final mineral'
                },
                price: '5.00',
                priceSuffix: { it: 'al calice', en: 'per glass', ro: 'la pahar' },
                allergens: [ALLERGEN.SULPHITES]
              },
              {
                type: 'divisor',
                title: { it: 'Rossi', en: 'Red Wines', ro: 'Vinuri Roșii' }
              },
              {
                title: { it: 'Chianti Classico DOCG', en: 'Chianti Classico DOCG', ro: 'Chianti Classico DOCG' },
                description: {
                  it: 'Toscana — Sangiovese in purezza, ciliegia e violetta',
                  en: 'Tuscany — pure Sangiovese, cherry and violet',
                  ro: 'Toscana — Sangiovese pur, cireșe și violete'
                },
                price: '7.00',
                priceSuffix: { it: 'al calice', en: 'per glass', ro: 'la pahar' },
                allergens: [ALLERGEN.SULPHITES]
              },
              {
                title: { it: 'Barbera d\'Alba', en: 'Barbera d\'Alba', ro: 'Barbera d\'Alba' },
                description: {
                  it: 'Piemonte — morbido e vellutato, frutta rossa matura',
                  en: 'Piedmont — soft and velvety, ripe red fruit',
                  ro: 'Piemont — moale și catifelat, fructe roșii coapte'
                },
                price: '6.00',
                priceSuffix: { it: 'al calice', en: 'per glass', ro: 'la pahar' },
                allergens: [ALLERGEN.SULPHITES]
              }
            ]
          }
        ]
      },

      {
        list_id: '1112',
        active: false,
        name: { it: 'Pranzo di Lavoro', en: 'Business Lunch', ro: 'Prânz de Lucru' },
        categories: [
          {
            category_id: '11121',
            name: { it: 'Formule', en: 'Set Menus', ro: 'Meniuri Fixe' },
            description: {
              it: 'Servito dal lunedì al venerdì, 12:00 – 14:30.',
              en: 'Served Monday to Friday, 12:00 – 14:30.',
              ro: 'Servit de luni până vineri, 12:00 – 14:30.'
            },
            items: [
              {
                title: { it: 'Formula Veloce', en: 'Quick Formula', ro: 'Formula Rapidă' },
                description: {
                  it: 'Un piatto a scelta dal menù del giorno, acqua e caffè',
                  en: 'One dish from the daily menu, water and coffee',
                  ro: 'Un fel din meniul zilei, apă și cafea'
                },
                price: '14.00',
                allergens: [ALLERGEN.GLUTEN]
              },
              {
                title: { it: 'Formula Completa', en: 'Full Formula', ro: 'Formula Completă' },
                description: {
                  it: 'Primo, secondo, acqua e caffè',
                  en: 'First course, main course, water and coffee',
                  ro: 'Primul fel, felul principal, apă și cafea'
                },
                price: '19.00',
                allergens: [ALLERGEN.GLUTEN, ALLERGEN.MILK]
              },
              {
                title: { it: 'Insalatona del Giorno', en: 'Daily Large Salad', ro: 'Salată Mare a Zilei' },
                description: {
                  it: 'Verdure di stagione, proteina a scelta e pane integrale',
                  en: 'Seasonal vegetables, protein of your choice and wholemeal bread',
                  ro: 'Legume de sezon, proteină la alegere și pâine integrală'
                },
                price: '12.00',
                allergens: [ALLERGEN.GLUTEN]
              }
            ]
          }
        ]
      }
    ]
  },

  {
    structure_id: '222',
    public_slug: 'caffe-mareluna',
    title: 'Caffè Mareluna',
    languages: ['it', 'en', 'ro'],
    language_main: 'it',
    currency: '€',
    color_main: '#8c5a3b',
    color_background: '#ffffff',
    contact: {
      address: 'Via San Marco 14, Milano',
      phone: '+39 02 0000 2222',
      email: 'bar@mareluna.example',
      website: 'https://mareluna.example',
      instagram: 'mareluna.bar'
    },
    profile: {
      it: 'Caffetteria & Cocktail Bar',
      en: 'Coffee Shop & Cocktail Bar',
      ro: 'Cafenea & Cocktail Bar'
    },
    description: {
      it: 'Il bar di quartiere della Trattoria Mareluna: caffè la mattina, aperitivi la sera.',
      en: 'Trattoria Mareluna\'s neighbourhood bar: coffee in the morning, aperitivo at night.',
      ro: 'Barul de cartier al Trattoriei Mareluna: cafea dimineața, aperitive seara.'
    },

    lists: [
      {
        list_id: '2221',
        active: true,
        name: { it: 'Bar & Caffetteria', en: 'Bar & Coffee', ro: 'Bar & Cafenea' },
        categories: [
          {
            category_id: '22211',
            name: { it: 'Caffetteria', en: 'Coffee', ro: 'Cafea' },
            description: {
              it: 'Miscela arabica tostata a Milano.',
              en: 'Arabica blend roasted in Milan.',
              ro: 'Amestec arabica prăjit la Milano.'
            },
            items: [
              {
                title: { it: 'Espresso', en: 'Espresso', ro: 'Espresso' },
                description: {
                  it: 'Miscela della casa, tostatura media',
                  en: 'House blend, medium roast',
                  ro: 'Amestecul casei, prăjire medie'
                },
                price: '1.20',
                allergens: []
              },
              {
                title: { it: 'Cappuccino', en: 'Cappuccino', ro: 'Cappuccino' },
                description: {
                  it: 'Espresso e latte montato a vapore',
                  en: 'Espresso and steamed milk',
                  ro: 'Espresso și lapte spumat'
                },
                price: '1.60',
                allergens: [ALLERGEN.MILK]
              },
              {
                title: { it: 'Cornetto Artigianale', en: 'Artisan Croissant', ro: 'Croissant Artizanal' },
                description: {
                  it: 'Vuoto, alla crema o all\'albicocca',
                  en: 'Plain, custard or apricot',
                  ro: 'Simplu, cu cremă sau cu caise'
                },
                price: '1.80',
                allergens: [ALLERGEN.GLUTEN, ALLERGEN.EGGS, ALLERGEN.MILK]
              }
            ]
          },
          {
            category_id: '22212',
            name: { it: 'Aperitivi', en: 'Aperitivo', ro: 'Aperitive' },
            description: {
              it: 'Tutti i giorni dalle 18:00, con stuzzichini inclusi.',
              en: 'Every day from 18:00, snacks included.',
              ro: 'În fiecare zi de la 18:00, cu gustări incluse.'
            },
            items: [
              {
                title: { it: 'Spritz Veneziano', en: 'Venetian Spritz', ro: 'Spritz Vețian' },
                description: {
                  it: 'Prosecco, bitter, soda e una fetta d\'arancia',
                  en: 'Prosecco, bitter, soda and a slice of orange',
                  ro: 'Prosecco, bitter, sifon și o felie de portocală'
                },
                price: '8.00',
                allergens: [ALLERGEN.SULPHITES]
              },
              {
                title: { it: 'Negroni', en: 'Negroni', ro: 'Negroni' },
                description: {
                  it: 'Gin, vermouth rosso e bitter in parti uguali',
                  en: 'Gin, red vermouth and bitter in equal parts',
                  ro: 'Gin, vermut roșu și bitter în părți egale'
                },
                price: '9.00',
                allergens: [ALLERGEN.SULPHITES]
              },
              {
                title: { it: 'Analcolico della Casa', en: 'House Alcohol-Free', ro: 'Fără Alcool al Casei' },
                description: {
                  it: 'Agrumi, sciroppo di sambuco e soda',
                  en: 'Citrus, elderflower syrup and soda',
                  ro: 'Citrice, sirop de soc și sifon'
                },
                price: '6.00',
                allergens: []
              }
            ]
          }
        ]
      }
    ]
  }
]
