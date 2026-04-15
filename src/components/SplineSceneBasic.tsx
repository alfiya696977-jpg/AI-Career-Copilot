'use client'
 
import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card"
import { Spotlight } from "@/components/ui/spotlight"
import { motion, AnimatePresence } from "framer-motion"
 
interface SplineSceneBasicProps {
  score?: number;
  match?: number;
}

export function SplineSceneBasic({ score, match }: SplineSceneBasicProps) {
  return (
    <Card className="w-full h-[500px] bg-black/[0.96] relative overflow-hidden border-none rounded-none">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      
      <div className="flex h-full flex-col md:flex-row">
        {/* Left content */}
        <div className="flex-1 p-8 relative z-10 flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            AI Career Copilot
          </h1>
          <p className="mt-4 text-neutral-300 max-w-lg text-lg">
            Unlock your career potential with our hybrid ML + LLM analysis system. 
            Get precise scores, job matching, and deep AI insights in seconds.
          </p>
          <div className="mt-8 flex gap-8">
            <div className="flex flex-col">
              <span className="text-blue-400 font-bold text-2xl">98%</span>
              <span className="text-neutral-500 text-xs uppercase tracking-wider">Accuracy</span>
            </div>
            <div className="flex flex-col border-l border-neutral-800 pl-8">
              <span className="text-purple-400 font-bold text-2xl">10s</span>
              <span className="text-neutral-500 text-xs uppercase tracking-wider">Analysis Time</span>
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 relative min-h-[300px]">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
          
          {/* Metrics Overlays */}
          <AnimatePresence>
            {(score !== undefined || match !== undefined) && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-full h-full">
                  {score !== undefined && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5, x: 50 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      className="absolute top-1/4 right-10 bg-blue-500/10 backdrop-blur-xl border border-blue-500/20 p-6 rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.2)]"
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Resume Score</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-white">{score}</span>
                        <span className="text-blue-500/50 font-bold">/100</span>
                      </div>
                    </motion.div>
                  )}
                  
                  {match !== undefined && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5, x: -50 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      className="absolute bottom-1/4 left-10 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 p-6 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.2)]"
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Job Match</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black text-white">{match}%</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  )
}
