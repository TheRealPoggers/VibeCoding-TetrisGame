'use client'

import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'

const GAME_WIDTH = 720
const GAME_HEIGHT = 400
const TARGET_RADIUS = 38

export default function ClickTargetGame() {
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)

  useEffect(() => {
    const container = gameContainerRef.current
    if (!container) return

    let game: Phaser.Game | undefined
    let isActive = true

    async function startGame() {
      const Phaser = (await import('phaser')).default
      if (!isActive) return

      class TargetScene extends Phaser.Scene {
        private target!: Phaser.GameObjects.Arc
        private targetRing!: Phaser.GameObjects.Arc
        private targetCenter!: Phaser.GameObjects.Arc

        constructor() {
          super('target-scene')
        }

        create() {
          this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x123b3d).setOrigin(0)

          this.targetRing = this.add
            .circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, TARGET_RADIUS + 10)
            .setStrokeStyle(2, 0x6b9990, 0.65)

          this.target = this.add
            .circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, TARGET_RADIUS, 0xff765e)
            .setInteractive({ useHandCursor: true })

          this.targetCenter = this.add.circle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            11,
            0xffe5a3,
          )

          this.target.on('pointerdown', () => {
            setScore((currentScore) => currentScore + 1)

            const x = Phaser.Math.Between(TARGET_RADIUS + 12, GAME_WIDTH - TARGET_RADIUS - 12)
            const y = Phaser.Math.Between(TARGET_RADIUS + 12, GAME_HEIGHT - TARGET_RADIUS - 12)

            this.target.setPosition(x, y)
            this.targetRing.setPosition(x, y)
            this.targetCenter.setPosition(x, y)
          })
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent: container,
        backgroundColor: '#123b3d',
        scene: TargetScene,
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
    setRound((currentRound) => currentRound + 1)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5ef] px-5 py-10 text-[#192f2d]">
      <div className="w-full max-w-3xl">
        <header className="mb-5 flex items-end justify-between gap-4">
          <h1 className="text-3xl font-bold">Click the target</h1>
          <div aria-live="polite" className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#62817b]">
              Score
            </p>
            <p className="text-3xl font-bold tabular-nums">{score}</p>
          </div>
        </header>

        <div
          ref={gameContainerRef}
          aria-label={`Click the target game. Current score: ${score}.`}
          className="aspect-[9/5] w-full overflow-hidden rounded-lg bg-[#123b3d] [&_canvas]:block [&_canvas]:!h-full [&_canvas]:!w-full"
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