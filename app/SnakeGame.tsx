'use client'

import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'

const GRID_COLUMNS = 20
const GRID_ROWS = 15
const CELL_SIZE = 28
const GAME_WIDTH = GRID_COLUMNS * CELL_SIZE
const GAME_HEIGHT = GRID_ROWS * CELL_SIZE
const MOVE_INTERVAL = 140

type Point = { x: number; y: number }
type Direction = Point
type GameStatus = 'playing' | 'game-over' | 'won'

function isOpposite(first: Direction, second: Direction) {
  return first.x === -second.x && first.y === -second.y
}

export default function SnakeGame() {
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<GameStatus>('playing')
  const [round, setRound] = useState(0)

  useEffect(() => {
    const container = gameContainerRef.current
    if (!container) return

    let game: Phaser.Game | undefined
    let isActive = true

    async function startGame() {
      const Phaser = (await import('phaser')).default
      if (!isActive) return

      class SnakeScene extends Phaser.Scene {
        private snake: Point[] = []
        private food: Point | null = null
        private direction: Direction = { x: 1, y: 0 }
        private nextDirection: Direction = { x: 1, y: 0 }
        private boardGraphics!: Phaser.GameObjects.Graphics
        private movementTimer!: Phaser.Time.TimerEvent

        constructor() {
          super('snake-scene')
        }

        create() {
          const centerX = Math.floor(GRID_COLUMNS / 2)
          const centerY = Math.floor(GRID_ROWS / 2)
          this.snake = [
            { x: centerX, y: centerY },
            { x: centerX - 1, y: centerY },
            { x: centerX - 2, y: centerY },
          ]
          this.direction = { x: 1, y: 0 }
          this.nextDirection = { x: 1, y: 0 }
          this.boardGraphics = this.add.graphics()

          this.input.keyboard?.on('keydown', this.handleKeyDown, this)
          this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off('keydown', this.handleKeyDown, this)
          })

          if (!this.placeFood()) {
            this.drawBoard()
            return
          }

          this.drawBoard()
          this.movementTimer = this.time.addEvent({
            delay: MOVE_INTERVAL,
            loop: true,
            callback: this.moveSnake,
            callbackScope: this,
          })
        }

        private handleKeyDown(event: KeyboardEvent) {
          let requestedDirection: Direction | undefined

          switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
              requestedDirection = { x: 0, y: -1 }
              break
            case 'ArrowDown':
            case 'KeyS':
              requestedDirection = { x: 0, y: 1 }
              break
            case 'ArrowLeft':
            case 'KeyA':
              requestedDirection = { x: -1, y: 0 }
              break
            case 'ArrowRight':
            case 'KeyD':
              requestedDirection = { x: 1, y: 0 }
              break
          }

          if (!requestedDirection) return
          event.preventDefault()

          if (
            isOpposite(requestedDirection, this.direction) ||
            isOpposite(requestedDirection, this.nextDirection)
          ) {
            return
          }

          this.nextDirection = requestedDirection
        }

        private moveSnake() {
          this.direction = this.nextDirection
          const head = this.snake[0]
          const nextHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y,
          }
          const eatingFood =
            this.food !== null &&
            nextHead.x === this.food.x &&
            nextHead.y === this.food.y
          const bodyToCheck = eatingFood ? this.snake : this.snake.slice(0, -1)
          const hitWall =
            nextHead.x < 0 ||
            nextHead.x >= GRID_COLUMNS ||
            nextHead.y < 0 ||
            nextHead.y >= GRID_ROWS
          const hitBody = bodyToCheck.some(
            (segment) => segment.x === nextHead.x && segment.y === nextHead.y,
          )

          if (hitWall || hitBody) {
            this.endGame('game-over')
            return
          }

          this.snake = eatingFood
            ? [nextHead, ...this.snake]
            : [nextHead, ...this.snake.slice(0, -1)]

          if (eatingFood) {
            setScore((currentScore) => currentScore + 1)

            if (!this.placeFood()) {
              this.drawBoard()
              return
            }
          }

          this.drawBoard()
        }

        private placeFood() {
          const emptyCells: Point[] = []

          for (let y = 0; y < GRID_ROWS; y += 1) {
            for (let x = 0; x < GRID_COLUMNS; x += 1) {
              const isOccupied = this.snake.some(
                (segment) => segment.x === x && segment.y === y,
              )
              if (!isOccupied) emptyCells.push({ x, y })
            }
          }

          if (emptyCells.length === 0) {
            this.food = null
            setStatus('won')
            this.movementTimer.paused = true
            return false
          }

          const foodIndex = Phaser.Math.Between(0, emptyCells.length - 1)
          this.food = emptyCells[foodIndex]
          return true
        }

        private endGame(nextStatus: GameStatus) {
          this.movementTimer.paused = true
          setStatus(nextStatus)
        }

        private drawBoard() {
          this.boardGraphics.clear()
          this.boardGraphics.fillStyle(0x143b39)
          this.boardGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
          this.boardGraphics.lineStyle(1, 0x28514a, 0.55)

          for (let column = 0; column <= GRID_COLUMNS; column += 1) {
            const x = column * CELL_SIZE
            this.boardGraphics.lineBetween(x, 0, x, GAME_HEIGHT)
          }

          for (let row = 0; row <= GRID_ROWS; row += 1) {
            const y = row * CELL_SIZE
            this.boardGraphics.lineBetween(0, y, GAME_WIDTH, y)
          }

          if (this.food) {
            this.boardGraphics.fillStyle(0xff765e)
            this.boardGraphics.fillCircle(
              this.food.x * CELL_SIZE + CELL_SIZE / 2,
              this.food.y * CELL_SIZE + CELL_SIZE / 2,
              CELL_SIZE * 0.34,
            )
          }

          this.snake.forEach((segment, index) => {
            this.boardGraphics.fillStyle(index === 0 ? 0xc5e7a4 : 0x77b88d)
            this.boardGraphics.fillRoundedRect(
              segment.x * CELL_SIZE + 2,
              segment.y * CELL_SIZE + 2,
              CELL_SIZE - 4,
              CELL_SIZE - 4,
              5,
            )
          })
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent: container,
        backgroundColor: '#143b39',
        scene: SnakeScene,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      })
    }

    void startGame()

    return () => {
      isActive = false
      game?.destroy(true)
    }
  }, [round])

  function restartGame() {
    setScore(0)
    setStatus('playing')
    setRound((currentRound) => currentRound + 1)
  }

  const statusLabel = status === 'playing' ? 'Playing' : status === 'won' ? 'Board cleared' : 'Game over'

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5ef] px-5 py-10 text-[#192f2d]">
      <div className="w-full max-w-3xl">
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Snake</h1>
            <p aria-live="polite" className="mt-1 text-sm text-[#62817b]">
              {statusLabel}
            </p>
          </div>
          <div aria-live="polite" className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#62817b]">
              Score
            </p>
            <p className="text-3xl font-bold tabular-nums">{score}</p>
          </div>
        </header>

        <div
          ref={gameContainerRef}
          aria-label="Snake game board. Use the arrow keys or WASD to move."
          className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#143b39] [&_canvas]:block [&_canvas]:!h-full [&_canvas]:!w-full"
        />

        <div className="mt-4 flex justify-end">
          <button
            className="rounded-md border border-[#b9c9c2] bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#e5eee8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287c70]"
            onClick={restartGame}
            type="button"
          >
            Restart
          </button>
        </div>
      </div>
    </main>
  )
}