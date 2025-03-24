// src/components/transactions/TransactionCreator.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMultiSigWallet } from '@/hooks/useMultiSigWallet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

interface TransactionCreatorProps {
  walletId: string
  onSuccess?: () => void
}

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  toAddress: z.string().min(1, 'Recipient address is required'),
  amount: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Amount must be a positive number',
  }),
  tokenAddress: z.string().optional(),
  description: z.string().optional(),
  data: z.string().optional(),
})

function TransactionCreator({ walletId, onSuccess }: TransactionCreatorProps) {
  const { createProposal, loading } = useMultiSigWallet({ walletId })
  const { toast } = useToast()
  const [isAdvanced, setIsAdvanced] = useState(false)
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      toAddress: '',
      amount: '',
      tokenAddress: '',
      description: '',
      data: '',
    },
  })
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await createProposal(
        walletId,
        values.title,
        values.description || '',
        values.toAddress,
        values.amount,
        values.tokenAddress || undefined,
        values.data || undefined
      )
      
      toast({
        title: 'Transaction created',
        description: 'Your transaction has been created successfully.',
      })
      
      form.reset()
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error creating transaction:', error)
      toast({
        title: 'Failed to create transaction',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      })
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Transaction</CardTitle>
        <CardDescription>
          Create a new transaction that will require approval from the wallet's signers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Transfer to Treasury" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="toAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Address</FormLabel>
                  <FormControl>
                    <Input placeholder="0x..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input placeholder="1.0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tokenAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Address (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Leave empty for native token" {...field} />
                    </FormControl>
                    <FormDescription>
                      Empty for native token
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Details about this transaction" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="button" 
              variant="link" 
              onClick={() => setIsAdvanced(!isAdvanced)}
              className="px-0"
            >
              {isAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
            </Button>
            
            {isAdvanced && (
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Data (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="0x..." 
                        className="font-mono"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Hexadecimal data for contract interactions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Transaction'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export { TransactionCreator }