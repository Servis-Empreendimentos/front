'use client'
import { useState } from 'react'

// Inspirado no sistema da Roesel Transportes: guarda no navegador a tela aberta,
// os filtros e os rascunhos, para nada se perder se a página recarregar
// (o Chrome às vezes descarta abas paradas há muito tempo) ou se você trocar de tela.

const PREFIXO = 'servis:'

function ler<T>(storage: Storage | undefined, chave: string, inicial: T): T {
  if (!storage) return inicial
  try {
    const salvo = storage.getItem(PREFIXO + chave)
    return salvo === null ? inicial : (JSON.parse(salvo) as T)
  } catch {
    return inicial
  }
}

function gravar(storage: Storage | undefined, chave: string, valor: unknown) {
  if (!storage) return
  try { storage.setItem(PREFIXO + chave, JSON.stringify(valor)) } catch {}
}

const sessao = () => (typeof window === 'undefined' ? undefined : window.sessionStorage)
const local = () => (typeof window === 'undefined' ? undefined : window.localStorage)

/** Igual a useState, mas lembra o valor enquanto a aba do navegador estiver aberta (sobrevive a recarregar a página). */
export function useEstadoLembrado<T>(chave: string, inicial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [valor, setValor] = useState<T>(() => ler(sessao(), chave, inicial))
  const atualizar = (v: T | ((prev: T) => T)) => {
    setValor(prev => {
      const novo = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      gravar(sessao(), chave, novo)
      return novo
    })
  }
  return [valor, atualizar]
}

export function lerLembrado<T>(chave: string, inicial: T): T {
  return ler(sessao(), chave, inicial)
}

export function gravarLembrado(chave: string, valor: unknown) {
  gravar(sessao(), chave, valor)
}

/** Rascunhos ficam neste computador até serem salvos ou descartados (sobrevivem a fechar o navegador). */
export function salvarRascunho(chave: string, valor: unknown) {
  gravar(local(), 'rascunho:' + chave, { salvoEm: new Date().toISOString(), valor })
}

export function lerRascunho<T>(chave: string): { salvoEm: string; valor: T } | null {
  return ler<{ salvoEm: string; valor: T } | null>(local(), 'rascunho:' + chave, null)
}

export function limparRascunho(chave: string) {
  try { local()?.removeItem(PREFIXO + 'rascunho:' + chave) } catch {}
}

/** Esquece filtros e tela lembrados (usado ao sair do sistema). */
export function limparLembrados() {
  const s = sessao()
  if (!s) return
  try {
    Object.keys(s).filter(k => k.startsWith(PREFIXO)).forEach(k => s.removeItem(k))
  } catch {}
}
