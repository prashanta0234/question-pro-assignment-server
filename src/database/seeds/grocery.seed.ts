import 'reflect-metadata';
import { DataSource } from 'typeorm';

require('dotenv').config();

interface SeedItem {
  name: string;
  description: string;
  price: number;
  stock: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const r  = (min: number, max: number): number =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100;
const ri = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// ── Produce ──────────────────────────────────────────────────────────────────

function produce(): SeedItem[] {
  const fruits = [
    'Apple - Fuji', 'Apple - Gala', 'Apple - Granny Smith', 'Apple - Honeycrisp',
    'Apple - Pink Lady', 'Apple - Red Delicious', 'Apple - Golden Delicious',
    'Apple - McIntosh', 'Apple - Braeburn', 'Apple - Jazz',
    'Orange - Navel', 'Orange - Blood', 'Orange - Cara Cara', 'Orange - Valencia',
    'Lemon', 'Lime', 'Grapefruit - Pink', 'Grapefruit - White', 'Grapefruit - Ruby Red',
    'Tangerine', 'Clementine', 'Mandarin', 'Pomelo', 'Kumquat',
    'Strawberry', 'Blueberry', 'Raspberry', 'Blackberry', 'Cranberry', 'Gooseberry',
    'Mango - Alphonso', 'Mango - Kent', 'Mango - Ataulfo',
    'Pineapple', 'Papaya', 'Guava', 'Passion Fruit', 'Dragon Fruit', 'Lychee', 'Rambutan',
    'Peach', 'Nectarine', 'Plum - Red', 'Plum - Black', 'Apricot',
    'Cherry - Sweet', 'Cherry - Sour', 'Cherry - Rainier',
    'Watermelon', 'Cantaloupe', 'Honeydew Melon', 'Canary Melon',
    'Banana', 'Banana - Plantain', 'Banana - Baby',
    'Green Grape', 'Red Grape', 'Black Grape', 'Cotton Candy Grape',
    'Pear - Bartlett', 'Pear - Bosc', 'Pear - Anjou', 'Pear - Asian',
    'Fig - Black', 'Fig - Green',
    'Kiwi - Green', 'Kiwi - Gold',
    'Avocado - Hass', 'Avocado - Fuerte',
    'Pomegranate', 'Coconut', 'Date - Medjool', 'Date - Deglet Noor',
    'Persimmon', 'Jackfruit', 'Starfruit', 'Quince',
  ];

  const vegetables = [
    'Spinach', 'Baby Spinach',
    'Kale - Curly', 'Kale - Lacinato', 'Kale - Red',
    'Arugula',
    'Romaine Lettuce', 'Iceberg Lettuce', 'Butter Lettuce', 'Green Leaf Lettuce', 'Red Leaf Lettuce',
    'Swiss Chard - Rainbow', 'Swiss Chard - White',
    'Bok Choy', 'Baby Bok Choy',
    'Napa Cabbage', 'Green Cabbage', 'Red Cabbage', 'Savoy Cabbage',
    'Carrot', 'Baby Carrot', 'Rainbow Carrot',
    'Potato - Russet', 'Potato - Yukon Gold', 'Potato - Red', 'Potato - Fingerling', 'Potato - Purple',
    'Sweet Potato - Orange', 'Sweet Potato - Purple', 'Sweet Potato - White',
    'Beet - Red', 'Beet - Golden', 'Beet - Chioggia',
    'Turnip', 'Parsnip',
    'Radish - Red', 'Radish - Watermelon', 'Daikon Radish',
    'White Onion', 'Yellow Onion', 'Red Onion', 'Pearl Onion',
    'Green Onion', 'Leek', 'Shallot',
    'Garlic - White', 'Garlic - Purple',
    'Broccoli', 'Broccolini', 'Broccoli Rabe',
    'Cauliflower - White', 'Cauliflower - Purple', 'Cauliflower - Orange',
    'Brussels Sprout', 'Kohlrabi',
    'Zucchini - Green', 'Zucchini - Yellow',
    'Butternut Squash', 'Acorn Squash', 'Spaghetti Squash', 'Delicata Squash',
    'Tomato - Beefsteak', 'Tomato - Roma', 'Cherry Tomato - Red', 'Cherry Tomato - Yellow',
    'Heirloom Tomato', 'Grape Tomato',
    'Cucumber - English', 'Cucumber - Persian', 'Cucumber - Kirby',
    'Bell Pepper - Red', 'Bell Pepper - Yellow', 'Bell Pepper - Orange', 'Bell Pepper - Green',
    'Jalapeño', 'Serrano Pepper', 'Habanero Pepper', 'Poblano Pepper', 'Anaheim Pepper',
    'Eggplant - Globe', 'Eggplant - Japanese', 'Eggplant - Chinese',
    'Corn - Yellow', 'Corn - White', 'Corn - Bi-Color',
    'Asparagus - Green', 'Asparagus - White', 'Asparagus - Purple',
    'Artichoke', 'Celery', 'Fennel',
    'Snow Peas', 'Sugar Snap Peas', 'Green Beans', 'Yellow Wax Beans',
    'Edamame', 'Lima Beans',
    'Mushroom - White Button', 'Mushroom - Cremini', 'Mushroom - Portobello',
    'Mushroom - Shiitake', 'Mushroom - Oyster', 'Mushroom - Enoki', 'Mushroom - King Trumpet',
    'Pumpkin - Sugar', 'Pumpkin - Pie',
    'Ginger Root', 'Turmeric Root', 'Horseradish Root',
    'Watercress', 'Microgreens Mix', 'Bean Sprout',
  ];

  const herbs = [
    'Basil - Sweet', 'Basil - Thai', 'Cilantro', 'Flat-Leaf Parsley', 'Curly Parsley',
    'Mint - Spearmint', 'Mint - Peppermint', 'Rosemary', 'Thyme', 'Oregano',
    'Sage', 'Chives', 'Tarragon', 'Dill', 'Lemongrass', 'Marjoram', 'Chervil',
  ];

  const produceSizes = ['250g', '500g', '1kg', '2kg', '3kg', '5kg'];
  const herbSizes    = ['30g', '50g', '100g'];
  const qualifiers   = ['', 'Organic '];
  const items: SeedItem[] = [];

  for (const q of qualifiers) {
    const label = q ? 'Certified organic' : 'Farm fresh';
    for (const fruit of fruits) {
      for (const size of produceSizes) {
        items.push({
          name: `${q}${fruit} ${size}`,
          description: `${label} ${fruit.toLowerCase()}, ${size} pack.`,
          price: r(0.99, 12.99),
          stock: ri(50, 500),
        });
      }
    }
    for (const veg of vegetables) {
      for (const size of produceSizes) {
        items.push({
          name: `${q}${veg} ${size}`,
          description: `${label} ${veg.toLowerCase()}, ${size} pack.`,
          price: r(0.79, 9.99),
          stock: ri(50, 500),
        });
      }
    }
    for (const herb of herbs) {
      for (const size of herbSizes) {
        items.push({
          name: `${q}${herb} ${size}`,
          description: `${label} ${herb.toLowerCase()}, ${size} bunch.`,
          price: r(0.99, 4.99),
          stock: ri(20, 150),
        });
      }
    }
  }

  return items;
}

// ── Dairy ────────────────────────────────────────────────────────────────────

function dairy(): SeedItem[] {
  const milkBrands   = ['Valley Farms', 'Meadow Fresh', 'Green Pastures', 'Sunrise', 'Pure Dairy', 'Highland Creamery', 'Sunridge'];
  const milkTypes    = ['Whole Milk', 'Reduced Fat 2% Milk', 'Low Fat 1% Milk', 'Skim Milk', 'Organic Whole Milk', 'Organic 2% Milk', 'Full Cream Milk', 'Lactose Free Milk'];
  const milkSizes    = ['500ml', '1L', '2L'];

  const altMilkBrands = ['Oatly', 'Alpro', 'Califia', 'Silk', 'Elmhurst'];
  const altMilkTypes  = ['Oat Milk Original', 'Oat Milk Barista', 'Almond Milk Original', 'Almond Milk Unsweetened', 'Soy Milk Original', 'Soy Milk Unsweetened', 'Coconut Milk', 'Cashew Milk'];
  const altMilkSizes  = ['1L', '2L'];

  const cheeseBrands  = ['Castello', 'Président', 'Arla', 'Tillamook'];
  const cheeseTypes   = [
    'Cheddar - Mild', 'Cheddar - Sharp', 'Cheddar - Extra Sharp', 'Cheddar - White',
    'Mozzarella - Fresh', 'Mozzarella - Part Skim', 'Mozzarella - Buffalo',
    'Gouda - Young', 'Gouda - Aged', 'Gouda - Smoked',
    'Swiss', 'Emmental', 'Gruyère',
    'Parmesan - Grated', 'Parmesan - Shaved', 'Parmesan - Block',
    'Brie', 'Camembert', 'Blue Cheese', 'Gorgonzola',
    'Feta - Original', 'Feta - Reduced Fat',
    'Ricotta', 'Mascarpone', 'Cream Cheese - Original', 'Cream Cheese - Light',
    'Provolone', 'Havarti', 'Manchego', 'Pepper Jack',
  ];
  const cheeseFormats = ['150g', '250g', '400g'];

  const yogurtBrands  = ['Chobani', 'Fage', 'Yoplait', 'Siggi\'s', 'Stonyfield'];
  const yogurtFlavors = [
    'Plain', 'Vanilla', 'Strawberry', 'Blueberry', 'Peach', 'Mango',
    'Raspberry', 'Cherry', 'Lemon', 'Coconut', 'Honey', 'Mixed Berry',
    'Greek Plain', 'Greek Vanilla', 'Greek Strawberry',
  ];
  const yogurtSizes   = ['150g', '500g', '1kg'];

  const butterTypes  = ['Salted Butter', 'Unsalted Butter', 'Organic Salted Butter', 'Organic Unsalted Butter', 'Grass-Fed Butter', 'European Style Butter'];
  const butterBrands = ['Kerrygold', 'Anchor', 'President', 'Lurpak'];
  const butterSizes  = ['250g', '500g'];

  const creamTypes  = ['Heavy Whipping Cream', 'Light Cream', 'Sour Cream', 'Half and Half', 'Crème Fraîche', 'Clotted Cream'];
  const creamBrands = ['Organic Valley', 'Daisy', 'Breakstone\'s', 'Horizon'];
  const creamSizes  = ['200ml', '500ml'];

  const eggTypes  = ['Free Range Eggs', 'Organic Eggs', 'Cage Free Eggs'];
  const eggSizes  = ['6 Pack', '12 Pack', '18 Pack'];
  const eggBrands = ['Happy Hen', 'Vital Farms', 'Pete and Gerry\'s', 'Eggland\'s Best'];

  const items: SeedItem[] = [];

  for (const brand of milkBrands)
    for (const type of milkTypes)
      for (const size of milkSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} carton.`, price: r(1.49, 5.99), stock: ri(50, 300) });

  for (const brand of altMilkBrands)
    for (const type of altMilkTypes)
      for (const size of altMilkSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} carton. Plant-based.`, price: r(2.49, 6.99), stock: ri(30, 200) });

  for (const brand of cheeseBrands)
    for (const type of cheeseTypes)
      for (const fmt of cheeseFormats)
        items.push({ name: `${brand} ${type} ${fmt}`, description: `${brand} ${type.toLowerCase()}, ${fmt} pack.`, price: r(2.99, 18.99), stock: ri(20, 200) });

  for (const brand of yogurtBrands)
    for (const flavor of yogurtFlavors)
      for (const size of yogurtSizes)
        items.push({ name: `${brand} ${flavor} Yogurt ${size}`, description: `${brand} ${flavor.toLowerCase()} yogurt, ${size} tub.`, price: r(1.49, 8.99), stock: ri(30, 250) });

  for (const brand of butterBrands)
    for (const type of butterTypes)
      for (const size of butterSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} block.`, price: r(2.49, 9.99), stock: ri(30, 200) });

  for (const brand of creamBrands)
    for (const type of creamTypes)
      for (const size of creamSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size}.`, price: r(1.99, 7.99), stock: ri(20, 150) });

  for (const brand of eggBrands)
    for (const type of eggTypes)
      for (const size of eggSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size}.`, price: r(2.99, 12.99), stock: ri(30, 200) });

  return items;
}

// ── Meat & Poultry ───────────────────────────────────────────────────────────

function meat(): SeedItem[] {
  const beefCuts   = [
    'Ribeye Steak', 'Sirloin Steak', 'T-Bone Steak', 'Porterhouse Steak', 'Filet Mignon',
    'New York Strip', 'Flank Steak', 'Skirt Steak', 'Flat Iron Steak', 'Chuck Roast',
    'Brisket', 'Short Ribs', 'Ground Beef 80/20', 'Ground Beef 90/10', 'Beef Tenderloin',
  ];
  const beefGrades  = ['Choice', 'Prime', 'Grass-Fed'];
  const beefWeights = ['300g', '500g', '750g', '1kg', '2kg'];

  const chickenCuts  = [
    'Whole Chicken', 'Chicken Breast - Boneless', 'Chicken Breast - Bone-In',
    'Chicken Thigh - Boneless', 'Chicken Thigh - Bone-In',
    'Chicken Drumstick', 'Chicken Wing', 'Chicken Leg Quarter',
    'Ground Chicken', 'Chicken Tenderloin', 'Chicken Cutlet', 'Whole Rotisserie Chicken',
  ];
  const chickenTypes   = ['Regular', 'Free Range', 'Organic'];
  const chickenWeights = ['400g', '600g', '1kg', '1.5kg'];

  const porkCuts   = [
    'Pork Chop - Bone-In', 'Pork Chop - Boneless', 'Pork Tenderloin',
    'Pork Shoulder', 'Pork Belly', 'Baby Back Ribs', 'Spare Ribs',
    'Ground Pork', 'Pork Loin Roast', 'Pork Sausage Links',
  ];
  const porkTypes   = ['Regular', 'Heritage Breed'];
  const porkWeights = ['400g', '750g', '1kg', '2kg'];

  const lambCuts   = ['Lamb Chop', 'Leg of Lamb', 'Lamb Shoulder', 'Lamb Rack', 'Ground Lamb', 'Lamb Shank', 'Lamb Loin Chop', 'Lamb Burger'];
  const lambWeights = ['400g', '750g', '1.5kg'];

  const turkeyProducts = ['Turkey Breast - Whole', 'Turkey Breast - Sliced', 'Ground Turkey', 'Turkey Thigh', 'Turkey Drumstick', 'Whole Turkey'];
  const turkeyWeights  = ['500g', '1kg', '2kg'];

  const items: SeedItem[] = [];

  for (const grade of beefGrades)
    for (const cut of beefCuts)
      for (const w of beefWeights)
        items.push({ name: `${grade} ${cut} ${w}`, description: `${grade} grade ${cut.toLowerCase()}, ${w} pack.`, price: r(5.99, 45.99), stock: ri(10, 150) });

  for (const type of chickenTypes)
    for (const cut of chickenCuts)
      for (const w of chickenWeights)
        items.push({ name: `${type} ${cut} ${w}`, description: `${type.toLowerCase()} ${cut.toLowerCase()}, ${w} pack.`, price: r(3.99, 22.99), stock: ri(20, 200) });

  for (const type of porkTypes)
    for (const cut of porkCuts)
      for (const w of porkWeights)
        items.push({ name: `${type} ${cut} ${w}`, description: `${type.toLowerCase()} ${cut.toLowerCase()}, ${w} pack.`, price: r(4.99, 24.99), stock: ri(15, 150) });

  for (const cut of lambCuts)
    for (const w of lambWeights)
      items.push({ name: `${cut} ${w}`, description: `Fresh ${cut.toLowerCase()}, ${w} pack.`, price: r(6.99, 35.99), stock: ri(10, 100) });

  for (const product of turkeyProducts)
    for (const w of turkeyWeights)
      items.push({ name: `${product} ${w}`, description: `Fresh ${product.toLowerCase()}, ${w} pack.`, price: r(4.99, 28.99), stock: ri(15, 120) });

  return items;
}

// ── Seafood ──────────────────────────────────────────────────────────────────

function seafood(): SeedItem[] {
  const fishTypes  = [
    'Atlantic Salmon', 'Pacific Salmon', 'Sockeye Salmon', 'King Salmon',
    'Tilapia', 'Cod', 'Haddock', 'Halibut', 'Mahi Mahi', 'Swordfish',
    'Sea Bass', 'Red Snapper', 'Trout', 'Catfish', 'Flounder',
    'Tuna - Yellowfin', 'Tuna - Bluefin', 'Sardine', 'Anchovy', 'Mackerel',
  ];
  const fishForms  = ['Fillet - Fresh', 'Fillet - Frozen', 'Whole', 'Steak'];
  const fishWeights = ['250g', '500g', '1kg'];

  const shellfish  = [
    'Shrimp - Large', 'Shrimp - Jumbo', 'Shrimp - Extra Jumbo',
    'Lobster Tail', 'King Crab Leg', 'Snow Crab Cluster',
    'Scallop - Sea', 'Scallop - Bay',
    'Clam - Little Neck', 'Mussel - Black',
  ];
  const shellfishForms  = ['Fresh', 'Frozen', 'Cooked'];
  const shellfishWeights = ['250g', '500g', '1kg'];

  const items: SeedItem[] = [];

  for (const type of fishTypes)
    for (const form of fishForms)
      for (const w of fishWeights)
        items.push({ name: `${type} ${form} ${w}`, description: `${type} ${form.toLowerCase()}, ${w} pack.`, price: r(5.99, 38.99), stock: ri(10, 120) });

  for (const shell of shellfish)
    for (const form of shellfishForms)
      for (const w of shellfishWeights)
        items.push({ name: `${shell} ${form} ${w}`, description: `${shell.toLowerCase()}, ${form.toLowerCase()}, ${w} pack.`, price: r(6.99, 55.99), stock: ri(10, 100) });

  return items;
}

// ── Bakery ───────────────────────────────────────────────────────────────────

function bakery(): SeedItem[] {
  const breadBrands = ['Pepperidge Farm', 'Dave\'s Killer Bread', 'Arnold', 'Nature\'s Own', 'La Brea'];
  const breadTypes  = [
    'White Sandwich Bread', 'Whole Wheat Bread', 'Multigrain Bread', 'Sourdough Loaf',
    'Rye Bread', 'Pumpernickel', 'Brioche Loaf', 'Ciabatta', 'Baguette',
    'Focaccia', 'Whole Grain Rolls 6-Pack', 'Dinner Rolls 12-Pack',
    'English Muffins 6-Pack', 'Bagels 6-Pack', 'Pita Bread 8-Pack',
    'Naan 4-Pack', 'Tortilla Wraps 8-Pack', 'Croissants 4-Pack',
  ];
  const breadSizes  = ['400g', '700g'];

  const pastryBrands = ['Entenmann\'s', 'Hostess', 'Little Debbie'];
  const pastryTypes  = [
    'Blueberry Muffin', 'Chocolate Chip Muffin', 'Bran Muffin', 'Lemon Poppy Seed Muffin',
    'Cinnamon Roll', 'Apple Danish', 'Cheese Danish', 'Pecan Coffee Cake',
    'Chocolate Donut', 'Glazed Donut', 'Blueberry Donut',
    'Banana Bread Loaf', 'Zucchini Bread Loaf', 'Pumpkin Bread Loaf',
    'Strawberry Shortcake', 'Pound Cake', 'Angel Food Cake',
  ];
  const pastrySizes = ['280g', '450g'];

  const items: SeedItem[] = [];

  for (const brand of breadBrands)
    for (const type of breadTypes)
      for (const size of breadSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} loaf.`, price: r(1.99, 9.99), stock: ri(30, 200) });

  for (const brand of pastryBrands)
    for (const type of pastryTypes)
      for (const size of pastrySizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(2.49, 8.99), stock: ri(20, 150) });

  return items;
}

// ── Beverages ────────────────────────────────────────────────────────────────

function beverages(): SeedItem[] {
  const waterBrands = ['Evian', 'Fiji', 'Volvic', 'Perrier', 'San Pellegrino', 'Poland Spring'];
  const waterTypes  = ['Still Water', 'Sparkling Water', 'Mineral Water', 'Alkaline Water', 'Flavored Sparkling Water - Lemon', 'Flavored Sparkling Water - Berry'];
  const waterSizes  = ['500ml', '1L', '1.5L', '2L'];

  const juiceBrands  = ['Tropicana', 'Minute Maid', 'Simply', 'Naked', 'Bolthouse'];
  const juiceTypes   = [
    'Orange Juice', 'Orange Juice - No Pulp', 'Apple Juice', 'Grape Juice',
    'Cranberry Juice', 'Grapefruit Juice', 'Pineapple Juice', 'Mango Juice',
    'Pomegranate Juice', 'Tomato Juice', 'Green Juice', 'Carrot Juice',
    'Watermelon Juice', 'Peach Nectar', 'Guava Nectar',
    'Lemonade', 'Pink Lemonade', 'Cherry Limeade',
    'Mixed Berry Juice', 'Acai Blend',
  ];
  const juiceSizes   = ['355ml', '1L', '1.89L'];

  const sodaBrands  = ['Coca-Cola', 'Pepsi', 'Dr Pepper', 'Sprite'];
  const sodaFlavors = [
    'Classic Cola', 'Diet Cola', 'Zero Sugar Cola', 'Cherry Cola', 'Vanilla Cola',
    'Lemon Lime', 'Diet Lemon Lime', 'Ginger Ale', 'Root Beer', 'Orange Soda',
    'Grape Soda', 'Cream Soda', 'Club Soda', 'Tonic Water', 'Sparkling Water Plain',
  ];
  const sodaSizes   = ['355ml Can', '600ml Bottle', '1L Bottle', '2L Bottle'];

  const coffeeBrands = ['Starbucks', 'Lavazza', 'Illy', 'Folgers', 'Nespresso'];
  const coffeeTypes  = [
    'Ground Coffee - Dark Roast', 'Ground Coffee - Medium Roast', 'Ground Coffee - Light Roast',
    'Whole Bean - Espresso', 'Whole Bean - Colombian', 'Whole Bean - Ethiopian',
    'Instant Coffee - Classic', 'Instant Coffee - Gold',
    'Coffee Pods - Dark', 'Coffee Pods - Medium', 'Coffee Pods - Decaf',
    'Cold Brew Concentrate',
  ];
  const coffeeSizes  = ['250g', '500g', '1kg'];

  const teaBrands = ['Twinings', 'Lipton', 'Bigelow', 'Celestial Seasonings', 'Tazo'];
  const teaTypes  = [
    'English Breakfast', 'Earl Grey', 'Green Tea', 'Jasmine Green Tea', 'Sencha',
    'Chamomile', 'Peppermint', 'Ginger Lemon', 'Rooibos', 'Hibiscus',
    'White Tea', 'Oolong Tea', 'Matcha Powder', 'Black Tea - Assam', 'Herbal Blend',
  ];
  const teaSizes  = ['20 Bags', '40 Bags', '80 Bags'];

  const energyBrands  = ['Red Bull', 'Monster', 'Celsius', 'Reign'];
  const energyFlavors = [
    'Original', 'Sugar Free', 'Tropical', 'Berry', 'Watermelon', 'Mango', 'Peach', 'Citrus',
  ];
  const energySizes   = ['250ml', '500ml'];

  const items: SeedItem[] = [];

  for (const brand of waterBrands)
    for (const type of waterTypes)
      for (const size of waterSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} bottle.`, price: r(0.79, 4.99), stock: ri(50, 400) });

  for (const brand of juiceBrands)
    for (const type of juiceTypes)
      for (const size of juiceSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size}.`, price: r(1.49, 7.99), stock: ri(30, 250) });

  for (const brand of sodaBrands)
    for (const flavor of sodaFlavors)
      for (const size of sodaSizes)
        items.push({ name: `${brand} ${flavor} ${size}`, description: `${brand} ${flavor.toLowerCase()}, ${size}.`, price: r(0.99, 3.99), stock: ri(50, 400) });

  for (const brand of coffeeBrands)
    for (const type of coffeeTypes)
      for (const size of coffeeSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size}.`, price: r(4.99, 24.99), stock: ri(20, 200) });

  for (const brand of teaBrands)
    for (const type of teaTypes)
      for (const size of teaSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(2.99, 12.99), stock: ri(20, 200) });

  for (const brand of energyBrands)
    for (const flavor of energyFlavors)
      for (const size of energySizes)
        items.push({ name: `${brand} Energy Drink ${flavor} ${size}`, description: `${brand} ${flavor.toLowerCase()} energy drink, ${size} can.`, price: r(1.79, 4.99), stock: ri(30, 250) });

  return items;
}

// ── Snacks ───────────────────────────────────────────────────────────────────

function snacks(): SeedItem[] {
  const chipBrands  = ['Lay\'s', 'Pringles', 'Kettle Brand', 'Cape Cod'];
  const chipFlavors = [
    'Classic Original', 'Sea Salt', 'Barbecue', 'Sour Cream and Onion',
    'Cheddar Cheese', 'Salt and Vinegar', 'Jalapeño', 'Honey Mustard',
    'Ranch', 'Dill Pickle', 'Lime Chili', 'Sriracha',
    'Reduced Fat Original', 'Baked Original', 'Sweet Chili', 'Buffalo Wing',
    'Smoky Bacon', 'Paprika',
  ];
  const chipSizes   = ['150g', '250g', '450g'];

  const cookieBrands = ['Pepperidge Farm', 'Nabisco', 'Keebler', 'Annie\'s', 'Back to Nature'];
  const cookieTypes  = [
    'Chocolate Chip', 'Double Chocolate', 'Snickerdoodle', 'Oatmeal Raisin',
    'Peanut Butter', 'Sugar Cookie', 'Gingerbread', 'Shortbread',
    'Macadamia White Chip', 'Lemon Drizzle', 'Coconut Macaroon', 'Almond Biscotti',
  ];
  const cookieSizes  = ['200g', '300g', '450g'];

  const crackerBrands = ['Ritz', 'Triscuit', 'Carr\'s', 'Mary\'s Gone Crackers', 'Wasa'];
  const crackerTypes  = [
    'Original Crackers', 'Whole Wheat Crackers', 'Multigrain Crackers', 'Rosemary Crackers',
    'Cheese Crackers', 'Sea Salt Crackers', 'Sesame Crackers', 'Rice Crackers',
    'Graham Crackers', 'Sourdough Crackers',
  ];
  const crackerSizes  = ['150g', '250g', '400g'];

  const nutBrands = ['Planters', 'Blue Diamond', 'Wonderful'];
  const nutTypes  = [
    'Almonds - Whole', 'Almonds - Sliced', 'Almonds - Roasted Salted', 'Almonds - Honey Roasted',
    'Cashews - Whole', 'Cashews - Roasted', 'Cashews - Honey Roasted',
    'Walnuts - Halves', 'Walnuts - Pieces',
    'Pistachios - In Shell', 'Pistachios - Shelled',
    'Peanuts - Dry Roasted', 'Peanuts - Honey Roasted', 'Peanuts - Salted',
    'Mixed Nuts - Deluxe', 'Pecans - Halves', 'Macadamia Nuts',
    'Brazil Nuts', 'Hazelnuts', 'Pine Nuts',
  ];
  const nutSizes  = ['150g', '250g', '500g', '1kg'];

  const chocolateBrands = ['Lindt', 'Ghirardelli', 'Green & Black\'s', 'Toblerone'];
  const chocolateTypes  = [
    '70% Dark Chocolate', '85% Dark Chocolate', 'Milk Chocolate', 'White Chocolate',
    'Dark Chocolate Almond', 'Milk Chocolate Hazelnut', 'Dark Chocolate Orange',
    'Milk Chocolate Caramel', 'Dark Chocolate Mint', 'White Chocolate Raspberry',
    'Dark Chocolate Sea Salt', 'Milk Chocolate Toffee', 'Dark Chocolate Cherry',
  ];
  const chocolateSizes  = ['100g', '200g', '400g'];

  const popcornBrands  = ['Angie\'s', 'SkinnyPop', 'Boom Chicka Pop'];
  const popcornFlavors = [
    'Classic Butter', 'Sea Salt', 'White Cheddar', 'Kettle Corn',
    'Ranch', 'Caramel', 'Dark Chocolate', 'Jalapeño Cheddar',
  ];
  const popcornSizes   = ['100g', '200g', '400g'];

  const items: SeedItem[] = [];

  for (const brand of chipBrands)
    for (const flavor of chipFlavors)
      for (const size of chipSizes)
        items.push({ name: `${brand} ${flavor} Chips ${size}`, description: `${brand} ${flavor.toLowerCase()} flavored chips, ${size} bag.`, price: r(1.49, 6.99), stock: ri(30, 300) });

  for (const brand of cookieBrands)
    for (const type of cookieTypes)
      for (const size of cookieSizes)
        items.push({ name: `${brand} ${type} Cookies ${size}`, description: `${brand} ${type.toLowerCase()} cookies, ${size} pack.`, price: r(2.49, 8.99), stock: ri(20, 200) });

  for (const brand of crackerBrands)
    for (const type of crackerTypes)
      for (const size of crackerSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} box.`, price: r(1.99, 7.99), stock: ri(20, 200) });

  for (const brand of nutBrands)
    for (const type of nutTypes)
      for (const size of nutSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(2.99, 18.99), stock: ri(20, 200) });

  for (const brand of chocolateBrands)
    for (const type of chocolateTypes)
      for (const size of chocolateSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()} bar, ${size}.`, price: r(1.99, 12.99), stock: ri(20, 200) });

  for (const brand of popcornBrands)
    for (const flavor of popcornFlavors)
      for (const size of popcornSizes)
        items.push({ name: `${brand} ${flavor} Popcorn ${size}`, description: `${brand} ${flavor.toLowerCase()} popcorn, ${size} bag.`, price: r(1.99, 6.99), stock: ri(20, 200) });

  return items;
}

// ── Frozen Foods ─────────────────────────────────────────────────────────────

function frozen(): SeedItem[] {
  const mealBrands = ['Amy\'s', 'Healthy Choice', 'Lean Cuisine', 'Birds Eye'];
  const mealTypes  = [
    'Chicken Alfredo', 'Beef Lasagna', 'Cheese Lasagna', 'Macaroni and Cheese',
    'Chicken Tikka Masala', 'Beef Burrito Bowl', 'Veggie Enchiladas',
    'Shrimp Fried Rice', 'Pad Thai', 'Vegetable Stir Fry',
    'Lentil Soup', 'Minestrone Soup', 'Chicken Pot Pie', 'Shepherd\'s Pie',
    'Spinach and Cheese Stuffed Shells', 'Three Cheese Pizza', 'Veggie Burger Patties',
    'Turkey Meatballs', 'Beef Meatballs', 'Fish Sticks',
  ];
  const mealSizes  = ['280g', '450g'];

  const frozenVegBrands = ['Birds Eye', 'Green Giant', 'Cascadian Farm'];
  const frozenVegTypes  = [
    'Mixed Vegetables', 'Broccoli Florets', 'Peas', 'Sweet Corn', 'Green Beans',
    'Spinach - Chopped', 'Edamame in Pod', 'Stir Fry Vegetables', 'Riced Cauliflower',
    'Butternut Squash Cubed', 'Brussels Sprouts', 'Lima Beans', 'Black Eyed Peas',
    'Mango Chunks', 'Strawberry Slices', 'Blueberries', 'Mixed Berries',
  ];
  const frozenVegSizes  = ['400g', '750g', '1.5kg'];

  const pizzaBrands = ['DiGiorno', 'California Pizza Kitchen', 'Amy\'s'];
  const pizzaTypes  = [
    'Four Cheese', 'Pepperoni', 'Margherita', 'Veggie Supreme', 'BBQ Chicken',
    'Hawaiian', 'Meat Lovers', 'Mushroom Truffle', 'Spinach Artichoke', 'Buffalo Chicken',
  ];
  const pizzaSizes  = ['320g', '520g'];

  const iceCreamBrands  = ['Häagen-Dazs', 'Ben and Jerry\'s', 'Breyers', 'Talenti'];
  const iceCreamFlavors = [
    'Vanilla', 'Chocolate', 'Strawberry', 'Cookies and Cream', 'Mint Chocolate Chip',
    'Rocky Road', 'Butter Pecan', 'Cookie Dough', 'Salted Caramel', 'Coffee',
    'Pistachio', 'Peach', 'Mango Sorbet', 'Lemon Sorbet', 'Raspberry Sorbet',
  ];
  const iceCreamSizes   = ['473ml', '946ml', '1.5L'];

  const items: SeedItem[] = [];

  for (const brand of mealBrands)
    for (const type of mealTypes)
      for (const size of mealSizes)
        items.push({ name: `${brand} Frozen ${type} ${size}`, description: `${brand} frozen ${type.toLowerCase()}, ${size} meal.`, price: r(2.99, 12.99), stock: ri(20, 200) });

  for (const brand of frozenVegBrands)
    for (const type of frozenVegTypes)
      for (const size of frozenVegSizes)
        items.push({ name: `${brand} Frozen ${type} ${size}`, description: `${brand} frozen ${type.toLowerCase()}, ${size} bag.`, price: r(1.99, 7.99), stock: ri(30, 250) });

  for (const brand of pizzaBrands)
    for (const type of pizzaTypes)
      for (const size of pizzaSizes)
        items.push({ name: `${brand} Frozen Pizza ${type} ${size}`, description: `${brand} frozen ${type.toLowerCase()} pizza, ${size}.`, price: r(4.99, 14.99), stock: ri(20, 150) });

  for (const brand of iceCreamBrands)
    for (const flavor of iceCreamFlavors)
      for (const size of iceCreamSizes)
        items.push({ name: `${brand} ${flavor} Ice Cream ${size}`, description: `${brand} ${flavor.toLowerCase()} ice cream, ${size} tub.`, price: r(3.99, 14.99), stock: ri(20, 150) });

  return items;
}

// ── Pantry Staples ───────────────────────────────────────────────────────────

function pantry(): SeedItem[] {
  const pastaBrands = ['Barilla', 'De Cecco', 'Garofalo', 'Banza'];
  const pastaTypes  = [
    'Spaghetti', 'Linguine', 'Fettuccine', 'Penne Rigate', 'Rigatoni',
    'Fusilli', 'Farfalle', 'Orecchiette', 'Cavatappi', 'Angel Hair',
    'Lasagna Sheets', 'Pappardelle', 'Orzo',
  ];
  const pastaSizes  = ['400g', '500g', '1kg'];

  const riceBrands = ['Uncle Ben\'s', 'Lundberg', 'Carolina', 'Mahatma'];
  const riceTypes  = [
    'Long Grain White Rice', 'Basmati Rice', 'Jasmine Rice', 'Brown Rice',
    'Arborio Rice', 'Wild Rice Blend', 'Black Rice', 'Red Rice',
    'Short Grain Rice', 'Sushi Rice',
  ];
  const riceSizes  = ['500g', '1kg', '2kg', '5kg'];

  const grainBrands = ['Bob\'s Red Mill', 'Arrowhead Mills', 'Ancient Harvest'];
  const grainTypes  = [
    'Quinoa - White', 'Quinoa - Red', 'Quinoa - Tricolor',
    'Rolled Oats', 'Steel Cut Oats', 'Pearled Barley', 'Bulgur Wheat',
    'Couscous', 'Farro', 'Millet', 'Amaranth', 'Buckwheat Groats',
  ];
  const grainSizes  = ['400g', '800g', '1.5kg'];

  const noodleBrands = ['Nissin', 'Maruchan', 'Annie Chun\'s', 'A-Sha'];
  const noodleTypes  = [
    'Ramen Noodles', 'Udon Noodles', 'Soba Noodles', 'Rice Noodles - Thin',
    'Rice Noodles - Wide', 'Egg Noodles', 'Glass Noodles', 'Chow Mein Noodles',
    'Lo Mein Noodles', 'Pad Thai Noodles',
  ];
  const noodleSizes  = ['200g', '400g', '800g'];

  const items: SeedItem[] = [];

  for (const brand of pastaBrands)
    for (const type of pastaTypes)
      for (const size of pastaSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(1.49, 6.99), stock: ri(30, 300) });

  for (const brand of riceBrands)
    for (const type of riceTypes)
      for (const size of riceSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} bag.`, price: r(1.99, 14.99), stock: ri(30, 300) });

  for (const brand of grainBrands)
    for (const type of grainTypes)
      for (const size of grainSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(2.99, 10.99), stock: ri(20, 200) });

  for (const brand of noodleBrands)
    for (const type of noodleTypes)
      for (const size of noodleSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(1.49, 7.99), stock: ri(20, 200) });

  return items;
}

// ── Canned & Jarred Goods ────────────────────────────────────────────────────

function cannedGoods(): SeedItem[] {
  const vegBrands  = ['Del Monte', 'Green Giant', 'Libby\'s', 'Hunt\'s'];
  const cannedVeg  = [
    'Diced Tomatoes', 'Crushed Tomatoes', 'Tomato Paste', 'Tomato Sauce',
    'Sweet Corn', 'Green Beans', 'Peas', 'Artichoke Hearts',
    'Roasted Red Peppers', 'Green Chiles', 'Olives - Black', 'Olives - Green',
    'Beets - Sliced', 'Sauerkraut', 'Bamboo Shoots',
  ];
  const vegSizes   = ['400g', '800g'];

  const beanBrands = ['Bush\'s', 'Goya', 'Eden Foods', 'Amy\'s'];
  const beanTypes  = [
    'Black Beans', 'Pinto Beans', 'Kidney Beans - Red', 'Kidney Beans - Dark Red',
    'Chickpeas', 'Navy Beans', 'Great Northern Beans', 'Cannellini Beans',
    'Lentils - Brown', 'Lentils - Green',
  ];
  const beanSizes  = ['400g', '800g'];

  const soupBrands = ['Campbell\'s', 'Progresso', 'Wolfgang Puck', 'Amy\'s'];
  const soupTypes  = [
    'Chicken Noodle Soup', 'Tomato Soup', 'Minestrone', 'Lentil Soup',
    'Split Pea Soup', 'French Onion Soup', 'Clam Chowder', 'Beef Broth',
    'Chicken Broth', 'Vegetable Broth', 'Cream of Mushroom', 'Black Bean Soup',
  ];
  const soupSizes  = ['400ml', '800ml', '1L'];

  const fishBrands  = ['Bumble Bee', 'StarKist', 'Wild Planet', 'Crown Prince'];
  const cannedFish  = [
    'Tuna - Albacore in Water', 'Tuna - Chunk Light in Water', 'Tuna - in Olive Oil',
    'Salmon - Pink', 'Salmon - Red Sockeye', 'Sardines in Olive Oil',
    'Sardines in Tomato Sauce', 'Anchovies', 'Mackerel in Brine', 'Crab Meat',
  ];
  const fishSizes   = ['142g', '200g', '425g'];

  const items: SeedItem[] = [];

  for (const brand of vegBrands)
    for (const veg of cannedVeg)
      for (const size of vegSizes)
        items.push({ name: `${brand} ${veg} ${size}`, description: `${brand} ${veg.toLowerCase()}, ${size} can.`, price: r(0.89, 4.99), stock: ri(30, 300) });

  for (const brand of beanBrands)
    for (const type of beanTypes)
      for (const size of beanSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} can.`, price: r(0.99, 3.99), stock: ri(30, 300) });

  for (const brand of soupBrands)
    for (const type of soupTypes)
      for (const size of soupSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} can.`, price: r(1.49, 6.99), stock: ri(20, 200) });

  for (const brand of fishBrands)
    for (const type of cannedFish)
      for (const size of fishSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} can.`, price: r(1.49, 8.99), stock: ri(20, 200) });

  return items;
}

// ── Sauces, Oils & Condiments ────────────────────────────────────────────────

function saucesAndOils(): SeedItem[] {
  const pastaSauceBrands = ['Rao\'s', 'Prego', 'Ragu', 'Classico', 'Newman\'s Own'];
  const pastaSauceTypes  = [
    'Marinara', 'Tomato Basil', 'Arrabbiata', 'Vodka Sauce', 'Bolognese',
    'Alfredo', 'Pesto', 'Four Cheese', 'Roasted Garlic',
  ];
  const pastaSauceSizes  = ['400g', '680g'];

  const oilBrands = ['California Olive Ranch', 'Bertolli', 'Spectrum', 'La Tourangelle'];
  const oilTypes  = [
    'Extra Virgin Olive Oil', 'Pure Olive Oil', 'Light Olive Oil', 'Avocado Oil',
    'Coconut Oil - Virgin', 'Coconut Oil - Refined', 'Canola Oil',
    'Sunflower Oil', 'Vegetable Oil', 'Sesame Oil - Toasted', 'Peanut Oil',
    'Walnut Oil', 'Grapeseed Oil',
  ];
  const oilSizes  = ['250ml', '500ml', '1L'];

  const condimentBrands = ['Heinz', 'French\'s', 'Sir Kensington\'s', 'Primal Kitchen'];
  const condimentTypes  = [
    'Ketchup', 'Yellow Mustard', 'Dijon Mustard', 'Whole Grain Mustard',
    'Mayonnaise', 'Light Mayonnaise', 'Vegan Mayo', 'Sriracha', 'Tabasco',
    'Frank\'s Red Hot', 'Worcestershire Sauce', 'Soy Sauce', 'Teriyaki Sauce',
    'Hoisin Sauce', 'Oyster Sauce', 'Fish Sauce', 'Rice Vinegar', 'Apple Cider Vinegar',
  ];
  const condimentSizes  = ['200ml', '400ml', '750ml'];

  const jamBrands = ['Bonne Maman', 'Smucker\'s', 'Polaner', 'Crofter\'s'];
  const jamTypes  = [
    'Strawberry Jam', 'Raspberry Jam', 'Blueberry Jam', 'Apricot Jam',
    'Peach Preserves', 'Cherry Preserves', 'Blackberry Jam',
    'Orange Marmalade', 'Grape Jelly', 'Mixed Berry Jam',
  ];
  const jamSizes  = ['250g', '370g'];

  const items: SeedItem[] = [];

  for (const brand of pastaSauceBrands)
    for (const type of pastaSauceTypes)
      for (const size of pastaSauceSizes)
        items.push({ name: `${brand} ${type} Pasta Sauce ${size}`, description: `${brand} ${type.toLowerCase()} pasta sauce, ${size} jar.`, price: r(2.49, 10.99), stock: ri(20, 200) });

  for (const brand of oilBrands)
    for (const type of oilTypes)
      for (const size of oilSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} bottle.`, price: r(3.99, 22.99), stock: ri(20, 200) });

  for (const brand of condimentBrands)
    for (const type of condimentTypes)
      for (const size of condimentSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} bottle.`, price: r(1.49, 8.99), stock: ri(20, 250) });

  for (const brand of jamBrands)
    for (const type of jamTypes)
      for (const size of jamSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} jar.`, price: r(2.49, 8.99), stock: ri(20, 200) });

  return items;
}

// ── Baking ───────────────────────────────────────────────────────────────────

function baking(): SeedItem[] {
  const flourBrands = ['King Arthur', 'Bob\'s Red Mill', 'Gold Medal'];
  const flourTypes  = [
    'All-Purpose Flour', 'Bread Flour', 'Whole Wheat Flour', 'Cake Flour',
    'Almond Flour', 'Oat Flour', 'Gluten-Free All-Purpose Flour', 'Spelt Flour',
  ];
  const flourSizes  = ['1kg', '2kg', '5kg'];

  const sugarBrands = ['Domino', 'C&H', 'Bob\'s Red Mill'];
  const sugarTypes  = [
    'Granulated White Sugar', 'Brown Sugar - Light', 'Brown Sugar - Dark',
    'Powdered Sugar', 'Raw Cane Sugar', 'Coconut Sugar', 'Stevia', 'Monk Fruit Sweetener',
  ];
  const sugarSizes  = ['500g', '1kg', '2kg'];

  const spiceBrands = ['McCormick', 'Simply Organic', 'Frontier Co-op'];
  const spiceTypes  = [
    'Black Pepper - Ground', 'Black Pepper - Whole', 'Sea Salt - Fine', 'Sea Salt - Coarse',
    'Garlic Powder', 'Onion Powder', 'Paprika - Sweet', 'Paprika - Smoked',
    'Cumin - Ground', 'Coriander - Ground', 'Turmeric', 'Cinnamon - Ground',
    'Nutmeg', 'Chili Powder', 'Oregano - Dried', 'Basil - Dried',
    'Thyme - Dried', 'Rosemary - Dried', 'Cayenne Pepper', 'Curry Powder',
    'Garam Masala', 'Italian Seasoning', 'Everything Bagel Seasoning', 'Taco Seasoning',
  ];
  const spiceSizes  = ['50g', '100g'];

  const bakingMiscBrands = ['Argo', 'Fleischmann\'s', 'Ghirardelli', 'Toll House'];
  const bakingMiscTypes  = [
    'Baking Powder', 'Baking Soda', 'Instant Dry Yeast', 'Active Dry Yeast',
    'Vanilla Extract - Pure', 'Vanilla Extract - Imitation',
    'Semi-Sweet Chocolate Chips', 'Dark Chocolate Chips', 'White Chocolate Chips',
    'Cocoa Powder - Unsweetened', 'Cocoa Powder - Dutch Process',
  ];
  const bakingMiscSizes  = ['100g', '200g'];

  const items: SeedItem[] = [];

  for (const brand of flourBrands)
    for (const type of flourTypes)
      for (const size of flourSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} bag.`, price: r(2.49, 14.99), stock: ri(20, 200) });

  for (const brand of sugarBrands)
    for (const type of sugarTypes)
      for (const size of sugarSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(1.49, 9.99), stock: ri(20, 250) });

  for (const brand of spiceBrands)
    for (const type of spiceTypes)
      for (const size of spiceSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} jar.`, price: r(1.99, 8.99), stock: ri(20, 200) });

  for (const brand of bakingMiscBrands)
    for (const type of bakingMiscTypes)
      for (const size of bakingMiscSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(1.99, 9.99), stock: ri(20, 200) });

  return items;
}

// ── Breakfast ────────────────────────────────────────────────────────────────

function breakfast(): SeedItem[] {
  const cerealBrands = ['Kellogg\'s', 'General Mills', 'Post', 'Nature\'s Path'];
  const cerealTypes  = [
    'Corn Flakes', 'Frosted Flakes', 'Rice Krispies', 'Special K', 'Special K Red Berries',
    'Raisin Bran', 'All-Bran', 'Granola - Honey Oat', 'Granola - Berry',
    'Honey Smacks', 'Cap\'n Crunch', 'Cheerios', 'Honey Nut Cheerios', 'Multi Grain Cheerios',
    'Chex - Rice', 'Chex - Corn', 'Chex - Wheat', 'Lucky Charms',
    'Cocoa Puffs', 'Frosted Mini Wheats',
  ];
  const cerealSizes  = ['400g', '700g'];

  const oatBrands = ['Quaker', 'Bob\'s Red Mill', 'Nature\'s Path'];
  const oatTypes  = [
    'Old Fashioned Rolled Oats', 'Quick Oats', 'Steel Cut Oats',
    'Instant Oatmeal - Original', 'Instant Oatmeal - Maple Brown Sugar',
    'Instant Oatmeal - Apple Cinnamon', 'Instant Oatmeal - Strawberry',
  ];
  const oatSizes  = ['500g', '1kg', '2kg'];

  const spreadBrands = ['Jif', 'Skippy', 'Justin\'s', 'MaraNatha'];
  const spreadTypes  = [
    'Peanut Butter - Creamy', 'Peanut Butter - Crunchy', 'Peanut Butter - Natural Creamy',
    'Almond Butter - Creamy', 'Almond Butter - Crunchy', 'Almond Butter - Honey',
    'Sunflower Butter', 'Hazelnut Spread', 'Cashew Butter',
  ];
  const spreadSizes  = ['250g', '500g'];

  const granolaBrands = ['Kind', 'Purely Elizabeth', 'Nature Valley'];
  const granolaTypes  = [
    'Oats and Honey Granola', 'Dark Chocolate Granola', 'Blueberry Granola',
    'Maple Quinoa Granola', 'Coconut Almond Granola', 'Cranberry Pecan Granola',
    'Vanilla Nut Granola', 'Tropical Mango Granola',
  ];
  const granolaSizes  = ['300g', '500g', '1kg'];

  const items: SeedItem[] = [];

  for (const brand of cerealBrands)
    for (const type of cerealTypes)
      for (const size of cerealSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()} cereal, ${size} box.`, price: r(2.99, 9.99), stock: ri(20, 200) });

  for (const brand of oatBrands)
    for (const type of oatTypes)
      for (const size of oatSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(2.49, 10.99), stock: ri(20, 200) });

  for (const brand of spreadBrands)
    for (const type of spreadTypes)
      for (const size of spreadSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} jar.`, price: r(2.99, 12.99), stock: ri(20, 200) });

  for (const brand of granolaBrands)
    for (const type of granolaTypes)
      for (const size of granolaSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} bag.`, price: r(3.49, 12.99), stock: ri(20, 200) });

  return items;
}

// ── Health & Supplements ─────────────────────────────────────────────────────

function health(): SeedItem[] {
  const proteinBrands  = ['Optimum Nutrition', 'Garden of Life', 'Vega', 'Isopure'];
  const proteinFlavors = [
    'Chocolate Fudge', 'Double Chocolate', 'Vanilla Ice Cream', 'Strawberry',
    'Cookies and Cream', 'Peanut Butter', 'Banana', 'Salted Caramel',
    'Mocha', 'Birthday Cake', 'Unflavored', 'Mixed Berry',
  ];
  const proteinSizes   = ['500g', '1kg', '2kg'];

  const supplementBrands = ['Nature Made', 'Garden of Life', 'Solgar'];
  const supplementTypes  = [
    'Vitamin D3 1000IU', 'Vitamin D3 2000IU', 'Vitamin C 500mg', 'Vitamin C 1000mg',
    'Vitamin B12', 'Vitamin B Complex', 'Magnesium Glycinate', 'Zinc 50mg',
    'Omega-3 Fish Oil 1000mg', 'Omega-3 Fish Oil 2000mg', 'Probiotics 50 Billion CFU',
    'Iron 65mg', 'Calcium 600mg', 'Multivitamin - Men', 'Multivitamin - Women',
  ];
  const supplementSizes  = ['60 Capsules', '90 Capsules', '180 Capsules'];

  const superfoodBrands = ['Navitas', 'Terrasoul', 'Sunfood'];
  const superfoodTypes  = [
    'Chia Seeds', 'Flaxseeds - Ground', 'Hemp Seeds - Hulled',
    'Spirulina Powder', 'Chlorella Powder', 'Maca Powder',
    'Acai Powder', 'Cacao Nibs', 'Goji Berries',
    'Turmeric Powder', 'Ashwagandha Powder',
  ];
  const superfoodSizes  = ['200g', '500g', '1kg'];

  const items: SeedItem[] = [];

  for (const brand of proteinBrands)
    for (const flavor of proteinFlavors)
      for (const size of proteinSizes)
        items.push({ name: `${brand} Protein Powder ${flavor} ${size}`, description: `${brand} ${flavor.toLowerCase()} protein powder, ${size}.`, price: r(19.99, 79.99), stock: ri(10, 100) });

  for (const brand of supplementBrands)
    for (const type of supplementTypes)
      for (const size of supplementSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()} supplement, ${size}.`, price: r(9.99, 34.99), stock: ri(10, 100) });

  for (const brand of superfoodBrands)
    for (const type of superfoodTypes)
      for (const size of superfoodSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(5.99, 29.99), stock: ri(20, 150) });

  return items;
}

// ── Baby & Kids ──────────────────────────────────────────────────────────────

function baby(): SeedItem[] {
  const babyFoodBrands  = ['Gerber', 'Earth\'s Best', 'Plum Organics'];
  const babyFoodFlavors = [
    'Apple Puree', 'Pear Puree', 'Banana Puree', 'Sweet Potato Puree',
    'Carrot Puree', 'Pea Puree', 'Butternut Squash Puree',
    'Apple Blueberry', 'Mango Peach', 'Apple Spinach Kale',
    'Chicken and Vegetable', 'Turkey and Sweet Potato', 'Beef and Pea',
    'Multigrain Baby Cereal', 'Oatmeal Baby Cereal',
  ];
  const babyFoodSizes   = ['113g', '4-Pack 113g', '6-Pack 113g'];

  const formulaBrands = ['Similac', 'Enfamil', 'Earth\'s Best Organic'];
  const formulaTypes  = ['Newborn Formula', 'Infant Formula Stage 1', 'Follow-On Formula Stage 2', 'Toddler Formula Stage 3', 'Sensitive Formula'];
  const formulaSizes  = ['400g', '800g'];

  const kidsSnackBrands = ['Annie\'s', 'Happy Baby', 'Sprout'];
  const kidsSnackTypes  = [
    'Bunny Crackers - Cheddar', 'Bunny Crackers - Whole Wheat', 'Fruit Gummies',
    'Puffs - Apple', 'Puffs - Sweet Potato', 'Rice Cakes - Banana',
    'Yogurt Melts - Strawberry', 'Yogurt Melts - Mango', 'Veggie Straws',
    'Apple Sauce Squeeze Pouches 4-Pack',
  ];
  const kidsSnackSizes  = ['100g', '200g'];

  const items: SeedItem[] = [];

  for (const brand of babyFoodBrands)
    for (const flavor of babyFoodFlavors)
      for (const size of babyFoodSizes)
        items.push({ name: `${brand} ${flavor} ${size}`, description: `${brand} ${flavor.toLowerCase()} baby food, ${size}.`, price: r(0.89, 7.99), stock: ri(20, 150) });

  for (const brand of formulaBrands)
    for (const type of formulaTypes)
      for (const size of formulaSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} tin.`, price: r(14.99, 39.99), stock: ri(10, 80) });

  for (const brand of kidsSnackBrands)
    for (const type of kidsSnackTypes)
      for (const size of kidsSnackSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(2.49, 7.99), stock: ri(20, 150) });

  return items;
}

// ── Pet Food ─────────────────────────────────────────────────────────────────

function petFood(): SeedItem[] {
  const dogFoodBrands = ['Blue Buffalo', 'Royal Canin', 'Hill\'s Science Diet', 'Purina Pro Plan'];
  const dogFoodTypes  = [
    'Adult Dry Food - Chicken and Rice', 'Adult Dry Food - Beef and Vegetables',
    'Adult Dry Food - Salmon and Sweet Potato', 'Puppy Dry Food - Chicken',
    'Senior Dry Food - Chicken', 'Large Breed Dry Food',
    'Wet Food - Beef Stew', 'Wet Food - Chicken Gravy',
    'Grain Free - Turkey and Pea', 'Weight Control Dry Food',
  ];
  const dogFoodSizes  = ['1kg', '3kg', '7kg'];

  const catFoodBrands = ['Royal Canin', 'Hill\'s Science Diet', 'Purina ONE', 'Wellness'];
  const catFoodTypes  = [
    'Indoor Adult Dry Food', 'Hairball Control Dry Food', 'Kitten Dry Food',
    'Senior Dry Food', 'Urinary Health Dry Food',
    'Wet Food - Tuna Flakes', 'Wet Food - Chicken Pate',
    'Wet Food - Salmon in Gravy', 'Grain Free Dry Food', 'Weight Control Dry Food',
  ];
  const catFoodSizes  = ['400g', '1.5kg', '4kg'];

  const treatBrands = ['Milk-Bone', 'Zuke\'s', 'Blue Buffalo'];
  const treatTypes  = [
    'Dog Biscuits - Small', 'Dog Biscuits - Medium', 'Dog Biscuits - Large',
    'Dog Training Treats', 'Dog Dental Chews', 'Dog Jerky Treats',
    'Cat Treats - Chicken', 'Cat Treats - Tuna', 'Cat Dental Treats',
  ];
  const treatSizes  = ['200g', '450g'];

  const items: SeedItem[] = [];

  for (const brand of dogFoodBrands)
    for (const type of dogFoodTypes)
      for (const size of dogFoodSizes)
        items.push({ name: `${brand} Dog ${type} ${size}`, description: `${brand} ${type.toLowerCase()} for dogs, ${size} bag.`, price: r(9.99, 69.99), stock: ri(10, 100) });

  for (const brand of catFoodBrands)
    for (const type of catFoodTypes)
      for (const size of catFoodSizes)
        items.push({ name: `${brand} Cat ${type} ${size}`, description: `${brand} ${type.toLowerCase()} for cats, ${size}.`, price: r(6.99, 49.99), stock: ri(10, 100) });

  for (const brand of treatBrands)
    for (const type of treatTypes)
      for (const size of treatSizes)
        items.push({ name: `${brand} ${type} ${size}`, description: `${brand} ${type.toLowerCase()}, ${size} pack.`, price: r(3.99, 14.99), stock: ri(20, 150) });

  return items;
}

// ── Compile all items & deduplicate ──────────────────────────────────────────

function compileAll(): SeedItem[] {
  const generators = [
    produce, dairy, meat, seafood, bakery, beverages,
    snacks, frozen, pantry, cannedGoods, saucesAndOils,
    baking, breakfast, health, baby, petFood,
  ];

  const seen = new Set<string>();
  const items: SeedItem[] = [];

  for (const gen of generators) {
    for (const item of gen()) {
      if (!seen.has(item.name)) {
        seen.add(item.name);
        items.push(item);
      }
    }
  }

  return items;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seedGroceries(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('[seed:groceries] Connected to database.');

  const [{ count }] = await dataSource.query(
    `SELECT COUNT(*) as count FROM grocery_items`,
  ) as [{ count: string }];

  if (parseInt(count, 10) > 0) {
    console.log(`[seed:groceries] grocery_items already has ${count} rows — skipping. Truncate the table to re-seed.`);
    await dataSource.destroy();
    return;
  }

  const items = compileAll();
  console.log(`[seed:groceries] Generated ${items.length} unique items.`);

  // Insert in batches to avoid query size limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    // Build parameterized query for this batch
    const placeholders = batch
      .map((_, idx) => {
        const base = idx * 4;
        return `(gen_random_uuid(), $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, false, now(), now())`;
      })
      .join(',\n');

    const values = batch.flatMap(item => [item.name, item.description, item.price, item.stock]);

    await dataSource.query(
      `INSERT INTO grocery_items (id, name, description, price, stock, low_stock_notified, created_at, updated_at)
       VALUES ${placeholders}`,
      values,
    );

    inserted += batch.length;
    console.log(`[seed:groceries] Inserted ${inserted}/${items.length}...`);
  }

  console.log(`[seed:groceries] Done. Inserted ${items.length} rows into grocery_items.`);

  await dataSource.destroy();
}

seedGroceries().catch(err => {
  console.error('[seed:groceries] Fatal error:', err);
  process.exit(1);
});
