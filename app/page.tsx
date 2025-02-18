'use client'

import { useEffect, useState } from 'react'
import { TransactionList } from '@/components/transaction-list'
import { ExpenseForm } from '@/components/expense-form'
import { Button } from "@/components/ui/button"
import artifact from '../utils/abi/fundmate.contract_class.json'
import { Contract, AccountInterface } from 'starknet'
import { SessionAccountInterface, ArgentTMA } from '@argent/tma-wallet'

export default function ExpenseTracker() {
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [account, setAccount] = useState<SessionAccountInterface>()
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [contract, setContract] = useState<Contract>()
  const [argentTMA, setArgentTMA] = useState<ArgentTMA>()

  const FUNDMATE_ADDRESS = process.env.NEXT_PUBLIC_STARK_SWIRL_CONTRACT_ADDRESS || ''

  useEffect(() => {
    const initializeArgentTMA = async () => {
      if (typeof window === 'undefined') return;
      
      const { initWallet } = await import('@/lib/contracts');
      setArgentTMA(initWallet(FUNDMATE_ADDRESS));
    };

    initializeArgentTMA();
  }, [FUNDMATE_ADDRESS]);

  useEffect(() => {
    if (!argentTMA) return;

    const initializeWallet = async () => {
      try {
        const res = await argentTMA.connect()
        if (!res) {
          setIsConnected(false)
          return
        }

        const newAccount = res.account
        if (newAccount.getSessionStatus() !== 'VALID') {
          setIsConnected(false)
          return
        }

        setAccount(newAccount)
        const newContract = new Contract(
          artifact.abi,
          FUNDMATE_ADDRESS,
          newAccount as unknown as AccountInterface
        )
        setContract(newContract)
        setIsConnected(true)
      } catch (error) {
        console.error('Failed to connect:', error)
        setIsConnected(false)
      }
    }

    initializeWallet()
  }, [argentTMA, FUNDMATE_ADDRESS])

  // Sample transactions (move to state if they become dynamic)
  const transactions = [
    {
      id: 1,
      from: 'You',
      to: 'Filip',
      description: 'Filip Laurentiu',
      amount: 16.67,
      type: 'debt'
    },
    // ... other transactions
  ]

  const handleConnect = async () => {
    console.log('Connecting...')
    if (!argentTMA) return;
    try {
      console.log('Requesting connection...')
      setIsLoading(true)
      await argentTMA.requestConnection({ callbackData: 'fundmate_connection' })
    } catch (error) {
      console.error('Connection failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!argentTMA) return;
    try {
      setIsLoading(true)
      await argentTMA.clearSession()
      setAccount(undefined)
      setIsConnected(false)
      setContract(undefined)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAction(action: string, params: number[] | string[] | bigint[] = []) {
    if (!contract || !isConnected || !account) return;
    setIsLoading(true);

    try {
      const { executeContractAction } = await import('@/lib/contracts');
      
      const messages = {
        create_split_payment_request: { 
          success: 'Split payment request created! 💰', 
          error: 'Failed to create split payment 😕' 
        },
        pay_contribution: { 
          success: 'Payment contribution successful! 🎉', 
          error: 'Failed to contribute payment 😕' 
        },
        finalize_payment: { 
          success: 'Payment finalized! ✅', 
          error: 'Failed to finalize payment 😕' 
        },
        refund: { 
          success: 'Refund processed! ��', 
          error: 'Failed to process refund 😕' 
        }
      };

      const result = await executeContractAction(
        contract,
        account,
        argentTMA as ArgentTMA,
        action,
        params,
        messages[action as keyof typeof messages].success,
        messages[action as keyof typeof messages].error
      );

      setIsLoading(false);
      return result;
    } catch (error) {
      console.error('Action failed:', error);
      setIsLoading(false);
      return false;
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <main className="flex-1 container max-w-lg mx-auto p-4">
        {!isConnected && (
          <Button
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 text-lg mb-4"
            onClick={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        )}

        {!isConnected && (
          <>
          {isConnected && (
            <Button
              className="w-full bg-red-500 hover:bg-red-600 text-white py-6 text-lg mb-4"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              Disconnect Wallet
            </Button>
          )}

            {showExpenseForm ? (
              <ExpenseForm 
                onClose={() => setShowExpenseForm(false)}
                handleAction={handleAction}
                isLoading={isLoading}
              />
            ) : (
              <>
                <TransactionList transactions={transactions} />
                <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto">
                  <Button
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 text-lg"
                    onClick={() => setShowExpenseForm(true)}
                  >
                    ADD PAYMENT
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
