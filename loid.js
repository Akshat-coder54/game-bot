// 🐝 KillerBEE — All-in-one Minecraft Assistant upgrade Bot (v1.20.4)
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const armorManager = require('mineflayer-armor-manager')
const pvp = require('mineflayer-pvp').plugin
const collectBlock = require('mineflayer-collectblock').plugin
const { Vec3 } = require('vec3')
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')      

// === FIX for deprecated physicTick event ===
const oldEmit = EventEmitter.prototype.emit
EventEmitter.prototype.emit = function (event, ...args) {
  if (event === 'physicTick') event = 'physicsTick'
  return oldEmit.call(this, event, ...args)
}

// === CONFIG ===
const respawnFile = path.join(__dirname, 'respawn.json')
const bot = mineflayer.createBot({
  host: 'localhost',//here change host if its multiplayer 
  port: 63831,//here change port if its LAN and multiplayer then there port number given
  username: 'miss_killer',//change name as you like
  version: '1.20.4',
  auth: 'offline'
})

// === LOAD PLUGIN  ===
bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)
bot.loadPlugin(armorManager)
bot.loadPlugin(collectBlock)

// === ON SPAWN EVENT ===
bot.once('spawn', () => {
  bot.chat('⚙️ KillerBEE online — ready for your command, master!')
  const mcData = require('minecraft-data')(bot.version)
  bot.pathfinder.setMovements(new Movements(bot, mcData))

  // Load saved respawn if exist
  if (fs.existsSync(respawnFile)) {
    const data = JSON.parse(fs.readFileSync(respawnFile))
    bot.spawnPoint = new Vec3(data.x, data.y, data.z)
    bot.chat(`♻️ Respawn loaded at X=${data.x.toFixed(1)}, Y=${data.y.toFixed(1)}, Z=${data.z.toFixed(1)}`)
  } else {
    bot.spawnPoint = bot.entity.position.clone()
    bot.chat(`📍 Spawn set at X=${bot.spawnPoint.x.toFixed(1)}, Y=${bot.spawnPoint.y.toFixed(1)}, Z=${bot.spawnPoint.z.toFixed(1)}`)
  }
})

// === ERROR & DISCONNECT HANDLERS ===
bot.on('error', err => console.log('⚠️ Error:', err))
bot.on('end', () => console.log('❌ Bot disconnected.'))

// === CHAT COMMAND HANDLER ===
bot.on('chat', async (username, message) => {
  if (username === bot.username) return
  const player = bot.players[username]?.entity
  const msg = message.toLowerCase().trim()

  // === SPAWN COMMANDS ===
  if (msg === 'set spawn' && player) {
    bot.spawnPoint = player.position.clone()
    fs.writeFileSync(respawnFile, JSON.stringify(bot.spawnPoint))
    bot.chat(`📍 Respawn saved at X=${bot.spawnPoint.x.toFixed(1)}, Y=${bot.spawnPoint.y.toFixed(1)}, Z=${bot.spawnPoint.z.toFixed(1)}`)
  }

  if (msg === 'respawn here' && bot.spawnPoint) {
    bot.chat('♻️ Returning to saved spawn...')
    bot.pathfinder.setGoal(new goals.GoalBlock(bot.spawnPoint.x, bot.spawnPoint.y, bot.spawnPoint.z))
  }

  if (msg === 'respawn') {
    if (!bot.spawnPoint) return bot.chat('⚠️ No spawn point set!')
    bot.chat('🔄 Teleporting to spawn...')
    bot.entity.position.set(bot.spawnPoint.x, bot.spawnPoint.y, bot.spawnPoint.z)
  }

  // === SLEEP / WAKE ===
  if (msg === 'sleep') {
    const bed = bot.findBlock({ matching: block => block.name.includes('bed'), maxDistance: 16 })
    if (!bed) return bot.chat('❌ No bed nearby!')
    try {
      await bot.sleep(bot.blockAt(bed.position))
      bot.chat('💤 Sleeping now...')
      bot.spawnPoint = bed.position.clone()
      fs.writeFileSync(respawnFile, JSON.stringify(bot.spawnPoint))
      bot.chat(`🛏️ Respawn set at X=${bed.position.x}, Y=${bed.position.y}, Z=${bed.position.z}`)
    } catch (err) {
      bot.chat(`⚠️ Cannot sleep: ${err.message}`)
    }
  }

  if (msg === 'wake up') {
    if (!bot.isSleeping) return bot.chat('😐 I’m already awake.')
    try {
      await bot.wake()
      bot.chat('☀️ Awake and ready!')
    } catch (err) {
      bot.chat(`⚠️ Cannot wake: ${err.message}`)
    }
  }

  // === GENERAL COMMANDS ===
  if (msg === 'hello') bot.chat(`Hello ${username}! How can I assist you?`)
  if (msg === 'time') bot.chat(`🕒 World time: ${bot.time.timeOfDay}`)
  if (msg === 'position' || msg === 'where are you') {
    const p = bot.entity.position
    bot.chat(`📍 X=${p.x.toFixed(1)}, Y=${p.y.toFixed(1)}, Z=${p.z.toFixed(1)}`)
  }

  if (msg === 'quit') {
    bot.chat('§6==== 🐝 KillerBEE Commands ====')
    bot.chat('§eGeneral: §fhello, time, help, position')
    bot.chat('§eMovement: §ffollow me, come here, stop')
    bot.chat('§eCombat: §fequip weapon, attack, stop attack')
    bot.chat('§eTools: §fpickaxe, shovel, hoe, axe, sword, give tool <name>')
    bot.chat('§eMining: §fmine, mine all, mine down <n>, mine area <size>')
    bot.chat('§eInteraction: §fpush, collect, trade')
    bot.chat('§eInventory: §fdeposit loot')
    bot.chat('§eSpawn: §fset spawn, respawn here, respawn')
    bot.chat('§eNight Mode: §fsleep, wake up')
  }

  // === MOVEMENT ===
  if (msg === 'follow me' && player) {
    bot.pathfinder.setGoal(new goals.GoalFollow(player, 1), true)
    bot.chat('🚶 Following you.')
  }

  if (msg === 'come here' && player) {
    bot.pathfinder.setGoal(new goals.GoalNear(player.position.x, player.position.y, player.position.z, 1))
    bot.chat('🧭 Coming to you.')
  }

  if (msg === 'stop') {
    bot.pathfinder.stop()
    bot.chat('🛑 Stopped.')
  }

  // === TOOL HANDLEr ===
  const equipTool = async (toolName, label) => {
    const item = bot.inventory.items().find(i => i.name.includes(toolName))
    if (item) {
      await bot.equip(item, 'hand')
      bot.chat(`🔧 Equipped ${label || item.name}`)
    } else bot.chat(`⚠️ No ${toolName} found.`)
  }

  if (msg === 'pickaxe') await equipTool('pickaxe', 'Pickaxe')
  if (msg === 'shovel') await equipTool('shovel', 'Shovel')
  if (msg === 'hoe') await equipTool('hoe', 'Hoe')
  if (msg === 'axe') await equipTool('axe', 'Axe')
  if (msg === 'sword') await equipTool('sword', 'Sword')

  // === GIVE TOOL ===
  if (msg.startsWith('give ')) {
    const toolName = msg.split(' ')[2]
    const item = bot.inventory.items().find(i => i.name.includes(toolName))
    if (item && player) {
      await bot.tossStack(item)
      bot.chat(`🎁 Gave you my ${item.name}`)
    } else bot.chat('⚠️ I don’t have that tool.')
  }

  // === COMBAT ===
  if (msg === ' weapon') await equipTool('sword', 'Weapon')
  if (msg === 'attack') {
    const mob = bot.nearestEntity(e => e.type === 'mob')
    if (!mob) return bot.chat('😕 No mobs nearby.')
    bot.chat(`⚔️ Attacking ${mob.name}!`)
    bot.pvp.attack(mob)
  }
  if (msg === 'stop attack') {
    bot.pvp.stop()
    bot.chat('🛑 Stopped attacking.')
  }

  // === UNIVERSAL MINING ===
  if (msg.startsWith('mine all ')) {
    const blockName = msg.split(' ')[2]
    const targets = bot.findBlocks({
      matching: b => b.name.includes(blockName),
      maxDistance: 32,
      count: 64
    })
    if (!targets.length) return bot.chat(`❌ No "${blockName}" blocks nearby.`)
    bot.chat(`🪓 Found ${targets.length} ${blockName} blocks — mining...`)
    for (const pos of targets) {
      const block = bot.blockAt(pos)
      if (block && bot.canDigBlock(block)) {
        try {
          await bot.dig(block)
        } catch {}
      }
    }
    bot.chat(`✅ Finished mining all ${blockName}.`)
  }

  if (msg.startsWith('mine ')) {
    const blockName = msg.split(' ')[1]
    const target = bot.findBlock({ matching: b => b.name.includes(blockName), maxDistance: 32 })
    if (!target) return bot.chat(`❌ No "${blockName}" nearby.`)
    bot.chat(`⛏️ Mining ${target.name}...`)
    try {
      await bot.dig(target)
      bot.chat(`✅ Mined ${target.name}.`)
    } catch (err) {
      bot.chat(`⚠️ Failed to mine: ${err.message}`)
    }
  }

  // === DOOR / ITEM INTERACTION ===
  if (msg === 'push') {
    const door = bot.findBlock({ matching: b => b.name.includes('door'), maxDistance: 5 })
    if (!door) return bot.chat('🚪 No door nearby.')
    await bot.activateBlock(door)
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
      bot.chat('❌ Trade failed: ' + err.message)
    }
  }

  // === DEPOSIT LOOT ===
  if (msg === 'deposit loot') {
    const chest = bot.findBlock({ matching: b => b.name.includes('chest'), maxDistance: 10 })
    if (!chest) return bot.chat('📦 No chest nearby.')
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
      bot.chat('❌ Failed to deposit: ' + err.message)
    }
  }
})














