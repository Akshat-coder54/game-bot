// 🐝 KillerBEE — All-in-one Minecraft Assistant upgrade Bot
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const armorManager = require('mineflayer-armor-manager')
const pvp = require('mineflayer-pvp').plugin
const collectBlock = require('mineflayer-collectblock').plugin
const { Vec3 } = require('vec3')

// === BOT CONFIGURATION ===
const bot = mineflayer.createBot({
  host: 'localhost', //hre you can write host if its multiplayer     
  port: 65215,// port which u get through LAN or server address           
  username: 'killerBEE', //here u can change bot naame as u want or like
  version: '1.20.4',//here is version in which version your  data exists 
  auth: 'offline'
})

// === LOAD PLUGIN ===
bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)
bot.loadPlugin(armorManager)
bot.loadPlugin(collectBlock)

// === ON SPAWN EVENt ===
bot.once('spawn', () => {
  bot.chat('⚙️ KillerBEE online — ready for your command, master!')
  const mcData = require('minecraft-data')(bot.version)
  bot.pathfinder.setMovements(new Movements(bot, mcData))
})

// === EVENTS ===
bot.on('error', err => console.log('⚠️ Error:', err))
bot.on('end', () => console.log('❌ Bot disconnected.'))

// === AUTO SLEEP SYSTEM  ===
let sleeping = false
let manualWakeUp = false

setInterval(async () => {
  if (!bot.spawnPoint) return
  if (sleeping || manualWakeUp) return

  const time = bot.time.timeOfDay
  const isNight = time > 12541 && time < 23458

  if (isNight && !bot.isSleeping) {
    const bed = bot.findBlock({
      matching: block => block.name.includes('bed'),
      maxDistance: 11
    })
    if (bed) {
      try {
        await bot.sleep(bot.blockAt(bed.position))
        bot.chat('😴 Nighttime detected — going to sleep. Wake me with "wake up".')
        sleeping = true
      } catch (err) {
        bot.chat('⚠️ Could not sleep: ' + err.message)
      }
    } else {
      bot.chat('🌙 It’s night but I can’t find a bed nearby .')
    }
  }
}, 5000)

// === CHAT COMMANDs HANDLER===
bot.on('chat', async (username, message) => {
  if (username === bot.username) return
  const player = bot.players[username]?.entity
  const msg = message.toLowerCase().trim()

  // === WAKE UP ===
  if (msg === 'wakeup') {
    manualWakeUp = true
    if (bot.isSleeping) {
      try {
        await bot.wake()
        bot.chat('🌞 I’m awake & ready again!')
        sleeping = false
      } catch (err) {
        bot.chat('⚠️ Could not wake up: ' + err.message)
      }
    } else bot.chat('😐 I’m already awake.')
    setTimeout(() => (manualWakeUp = false), 5000)
  }

  // === GENERAL COMMANDS ===
  if (msg === 'hello') bot.chat(`Hello ${username}! How can I assist you?`)
  if (msg === 'time') bot.chat(`It’s currently ${bot.time.timeOfDay} ticks in the world.`)
  if (msg === 'position' || msg === 'where are you') {
    const pos = bot.entity.position
    bot.chat(`📍 My position: X=${pos.x.toFixed(1)}, Y=${pos.y.toFixed(1)}, Z=${pos.z.toFixed(1)}`)
  }

  if (msg === 'help') {
    bot.chat('§6==== 🐝 KillerBEE Command List ====')
    bot.chat('§eGeneral: §fhello, time, help, position')
    bot.chat('§eMovement: §ffollow me, come here, stop')
    bot.chat('§eCombat: §fequip weapon, equip armor, attack, stop attack')
    bot.chat('§eMining: §fmine down <n>, mine area <size>')
    bot.chat('§eInteraction: §ftoggle door, trade, collect')
    bot.chat('§eInventory: §fdeposit loot')
    bot.chat('§eNight Mode: §fauto sleep, wake up')
  }

  // === MOVEMENT ===
  if (msg === 'follow me' && player) {
    bot.pathfinder.setGoal(new goals.GoalFollow(player, 1), true)
    bot.chat('🚶 Following you!')
  }

  if (msg === 'come here' && player) {
    bot.pathfinder.setGoal(new goals.GoalNear(player.position.x, player.position.y, player.position.z, 1))
    bot.chat('🧭 On my way!')
  }

  if (msg === 'stop') {
    bot.pathfinder.stop()
    bot.chat('🛑 Stopped moving.')
  }

  // === COMBAT ===
  if (msg === 'equip weapon') {
    const weapon = bot.inventory.items().find(i => i.name.includes('sword') || i.name.includes('axe'))
    if (weapon) {
      await bot.equip(weapon, 'hand')
      bot.chat(`🗡️ Equipped ${weapon.name}`)
    } else bot.chat('⚠️ No weapon found!')
  }

  if (msg === 'equip armor') {
    try {
      await bot.armorManager.equipAll()
      bot.chat('🪖 Equipped all armor!')
    } catch {
      bot.chat('❌ Could not equip armor.')
    }
  }

  if (msg === 'attack') {
    const mob = bot.nearestEntity(e => e.type === 'mob')
    if (!mob) return bot.chat('😕 No mobs nearby.')
    bot.chat(`⚔️ Attacking ${mob.name}!`)
    bot.pvp.attack(mob)
  }

  if (msg === 'stop atk') {
    bot.pvp.stop()
    bot.chat('🛑 Stopped attacking.')
  }

  // === MINING ===
  if (msg.startsWith('mine down ')) {
    const n = parseInt(msg.split(' ')[2])
    if (isNaN(n)) return bot.chat('❌ Usage: mine down <number>')
    for (let i = 0; i < n; i++) {
      const block = bot.blockAt(bot.entity.position.offset(0, -1, 0))
      if (!block || !bot.canDigBlock(block)) return bot.chat('❌ Cannot mine further.')
      await bot.dig(block)
    }
    bot.chat(`⛏️ Mined ${n} blocks downward.`)
  }

  if (msg.startsWith('mine area ')) {
    const size = parseInt(msg.split(' ')[2])
    if (isNaN(size)) return bot.chat('❌ Usage: mine area <size>')
    const center = bot.entity.position.floored()
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) {
        const pos = center.offset(x, -1, z)
        const block = bot.blockAt(pos)
        if (block && bot.canDigBlock(block)) await bot.dig(block)
      }
    }
    bot.chat(`⛏️ Cleared ${size * size * 2} block area.`)
  }

  // === INTERACTION ===
  if (msg === 'toggle door') {
    const doorBlock = bot.findBlock({ matching: b => b.name.includes('door'), maxDistance: 5 })
    if (!doorBlock) return bot.chat('🚪 No door nearby.')
    bot.activateBlock(doorBlock)
    bot.chat('🚪 Door toggled.')
  }

  if (msg === 'collect') {
    const item = bot.nearestEntity(e => e.name === 'item')
    if (!item) return bot.chat('🎒 No dropped items nearby.')
    await bot.collectBlock.collect(item)
    bot.chat('📦 Collected nearby item!')
  }

  // === TRADE WITH VILLAGER ===
  if (msg === 'trade') {
    const villager = bot.nearestEntity(e => e.name === 'villager')
    if (!villager) return bot.chat('😕 No villager nearby.')
    bot.chat('💱 Attempting to trade...')
    try {
      const tradeWindow = await bot.openVillager(villager)
      const trade = tradeWindow.trades.find(t => t.inputItem1 && bot.inventory.count(t.inputItem1.type))
      if (trade) {
        await bot.trade(trade)
        bot.chat('✅ Trade completed!')
      } else bot.chat('⚠️ No affordable trade found.')
      tradeWindow.close()
    } catch (err) {
      bot.chat('❌ Failed to trade: ' + err.message)
    }
  }

  // === DEPOSIT LOOT IN CHEST ===
  if (msg === 'deposit loot') {
    const chest = bot.findBlock({ matching: b => b.name.includes('chest'), maxDistance: 10 })
    if (!chest) return bot.chat('📦 No chest nearby!')
    bot.chat('🧳 Depositing loot...')
    try {
      const chestWindow = await bot.openChest(bot.blockAt(chest.position))
      for (const item of bot.inventory.items()) {
        if (!['sword', 'axe', 'pickaxe', 'armor'].some(k => item.name.includes(k))) {
          await chestWindow.deposit(item.type, null, item.count)
        }
      }
      chestWindow.close()
      bot.chat('✅ All loot deposited!')
    } catch (err) {
      bot.chat('❌ Failed to deposit loot: ' + err.message)
    }
  }
})




























