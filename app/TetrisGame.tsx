'use client'

import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'

const BOARD_COLUMNS = 10
const BOARD_ROWS = 20
const CELL_SIZE = 28
const BOARD_WIDTH = BOARD_COLUMNS * CELL_SIZE
const BOARD_HEIGHT = BOARD_ROWS * CELL_SIZE
const GRAVITY_INTERVAL = 700
const MIN_GRAVITY_INTERVAL = 100
const LINE_CLEAR_SCORES: Record<1 | 2 | 3 | 4, number> = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
}

type Board = number[][]
type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

type TetrominoDefinition = {
  shape: number[][]
  color: number
}

type ActivePiece = {
  type: PieceType
  shape: number[][]
  color: number
  x: number
  y: number
}

const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

const TETROMINOES: Record<PieceType, TetrominoDefinition> = {
  I: { shape: [[1, 1, 1, 1]], color: 0x57c7d4 },
  O: { shape: [[1, 1], [1, 1]], color: 0xf2ce5b },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: 0xb47be5 },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: 0x7ed36b },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: 0xef6c72 },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: 0x6f91ed },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: 0xf29b52 },
}

function createBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () => Array<number>(BOARD_COLUMNS).fill(0))
}

export default function TetrisGame() {
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)

  useEffect(() => {
    const container = gameContainerRef.current
    if (!container) return

    let game: Phaser.Game | undefined
    let isActive = true

    async function startGame() {
      const Phaser = (await import('phaser')).default
      if (!isActive) return

      class BoardScene extends Phaser.Scene {
        private board: Board = createBoard()
        private activePiece!: ActivePiece
        private boardGraphics!: Phaser.GameObjects.Graphics
        private gravityTimer?: Phaser.Time.TimerEvent
        private isGameOver = false
        private score = 0
        private totalLines = 0
        private level = 1

        constructor() {
          super('tetris-board')
        }

        create() {
          this.boardGraphics = this.add.graphics()
          this.activePiece = this.createActivePiece()
          this.input.keyboard?.on('keydown', this.handleKeyDown, this)
          this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard?.off('keydown', this.handleKeyDown, this)
            this.gravityTimer?.remove(false)
          })
          this.drawGame()
          this.startGravityTimer()
        }

        private createActivePiece(): ActivePiece {
          const type = Phaser.Utils.Array.GetRandom(PIECE_TYPES)
          const definition = TETROMINOES[type]

          return {
            type,
            shape: definition.shape,
            color: definition.color,
            x: Math.floor((BOARD_COLUMNS - definition.shape[0].length) / 2),
            y: 0,
          }
        }

        private handleKeyDown(event: KeyboardEvent) {
          if (this.isGameOver) return

          let moveX = 0
          let moveY = 0
          let shouldRotate = false

          switch (event.code) {
            case 'ArrowLeft':
            case 'KeyA':
              moveX = -1
              break
            case 'ArrowRight':
            case 'KeyD':
              moveX = 1
              break
            case 'ArrowDown':
            case 'KeyS':
              moveY = 1
              break
            case 'ArrowUp':
            case 'KeyW':
            case 'KeyX':
              shouldRotate = true
              break
            default:
              return
          }

          event.preventDefault()

          if (shouldRotate) {
            this.rotatePiece()
          } else if (moveY > 0) {
            this.moveDown()
          } else {
            this.movePiece(moveX, moveY)
          }
        }

        private movePiece(moveX: number, moveY: number) {
          if (this.isGameOver) return

          const nextX = this.activePiece.x + moveX
          const nextY = this.activePiece.y + moveY

          if (!this.canMoveTo(nextX, nextY)) return

          this.activePiece.x = nextX
          this.activePiece.y = nextY
          this.drawGame()
        }

        private rotatePiece() {
          const rotatedShape = this.activePiece.shape[0].map((_, columnIndex) =>
            this.activePiece.shape.map((row) => row[columnIndex]).reverse(),
          )

          if (!this.canMoveTo(this.activePiece.x, this.activePiece.y, rotatedShape)) return

          this.activePiece.shape = rotatedShape
          this.drawGame()
        }

        private moveDown() {
          if (this.isGameOver) return

          if (this.canMoveTo(this.activePiece.x, this.activePiece.y + 1)) {
            this.activePiece.y += 1
            this.drawGame()
            return
          }

          this.lockPiece()
        }

        private lockPiece() {
          this.activePiece.shape.forEach((row, rowIndex) => {
            row.forEach((cell, columnIndex) => {
              if (cell === 0) return

              const boardX = this.activePiece.x + columnIndex
              const boardY = this.activePiece.y + rowIndex
              this.board[boardY][boardX] = 1
            })
          })

          const clearedRows = this.clearCompletedRows()
          if (clearedRows > 0) this.updateProgress(clearedRows)

          this.activePiece = this.createActivePiece()

          if (!this.canMoveTo(this.activePiece.x, this.activePiece.y)) {
            this.endGame()
            return
          }

          this.drawGame()
        }

        private clearCompletedRows() {
          const remainingRows = this.board.filter((row) => row.some((cell) => cell === 0))
          const clearedRows = BOARD_ROWS - remainingRows.length

          if (clearedRows === 0) return 0

          const emptyRows = Array.from({ length: clearedRows }, () =>
            Array<number>(BOARD_COLUMNS).fill(0),
          )
          this.board = [...emptyRows, ...remainingRows]
          return clearedRows
        }

        private updateProgress(clearedRows: number) {
          const baseScore = LINE_CLEAR_SCORES[clearedRows as keyof typeof LINE_CLEAR_SCORES]
          this.score += baseScore * this.level
          this.totalLines += clearedRows

          setScore(this.score)
          setLines(this.totalLines)

          const nextLevel = Math.floor(this.totalLines / 10) + 1
          if (nextLevel !== this.level) {
            this.level = nextLevel
            setLevel(this.level)
            this.startGravityTimer()
          }
        }

        private startGravityTimer() {
          this.gravityTimer?.remove(false)
          const delay = Math.max(
            MIN_GRAVITY_INTERVAL,
            GRAVITY_INTERVAL - (this.level - 1) * 55,
          )

          this.gravityTimer = this.time.addEvent({
            delay,
            loop: true,
            callback: this.moveDown,
            callbackScope: this,
          })
        }

        private endGame() {
          this.isGameOver = true
          if (this.gravityTimer) this.gravityTimer.paused = true
          this.add
            .rectangle(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_WIDTH, BOARD_HEIGHT, 0x06161a, 0.78)
            .setDepth(1)
          this.add
            .text(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 'Game Over', {
              color: '#ffffff',
              fontSize: '32px',
              fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setDepth(2)
        }

        private canMoveTo(nextX: number, nextY: number, shape = this.activePiece.shape) {
          return shape.every((row, rowIndex) =>
            row.every((cell, columnIndex) => {
              if (cell === 0) return true

              const boardX = nextX + columnIndex
              const boardY = nextY + rowIndex
              const outsideBoard =
                boardX < 0 ||
                boardX >= BOARD_COLUMNS ||
                boardY < 0 ||
                boardY >= BOARD_ROWS

              return !outsideBoard && this.board[boardY][boardX] === 0
            }),
          )
        }

        private drawGame() {
          this.boardGraphics.clear()
          this.boardGraphics.fillStyle(0x10282b)
          this.boardGraphics.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)

          for (let row = 0; row < BOARD_ROWS; row += 1) {
            for (let column = 0; column < BOARD_COLUMNS; column += 1) {
              const cellColor = this.board[row][column] === 0 ? 0x1a393b : 0x71b58b
              this.boardGraphics.fillStyle(cellColor)
              this.boardGraphics.fillRect(
                column * CELL_SIZE + 1,
                row * CELL_SIZE + 1,
                CELL_SIZE - 2,
                CELL_SIZE - 2,
              )
            }
          }

          this.boardGraphics.fillStyle(this.activePiece.color)
          this.activePiece.shape.forEach((row, rowIndex) => {
            row.forEach((cell, columnIndex) => {
              if (cell === 0) return

              this.boardGraphics.fillRect(
                (this.activePiece.x + columnIndex) * CELL_SIZE + 1,
                (this.activePiece.y + rowIndex) * CELL_SIZE + 1,
                CELL_SIZE - 2,
                CELL_SIZE - 2,
              )
            })
          })
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        parent: container,
        backgroundColor: '#10282b',
        scene: BoardScene,
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
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5ef] px-5 py-8 text-[#192f2d]">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-bold">Tetris</h1>
        <div className="grid w-full grid-cols-3 gap-3 text-center" aria-live="polite">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#62817b]">Score</p>
            <p className="text-xl font-bold tabular-nums">{score}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#62817b]">Level</p>
            <p className="text-xl font-bold tabular-nums">{level}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#62817b]">Lines</p>
            <p className="text-xl font-bold tabular-nums">{lines}</p>
          </div>
        </div>
        <div
          ref={gameContainerRef}
          aria-label="Tetris board with 10 columns, 20 rows, and one active piece"
          className="aspect-[1/2] w-[min(70vw,280px)] overflow-hidden rounded-md bg-[#10282b] [&_canvas]:block [&_canvas]:!h-full [&_canvas]:!w-full"
        />
      </div>
    </main>
  )
}