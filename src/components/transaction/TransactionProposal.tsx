// src/components/transactions/TransactionProposal.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useWallet } from "@/context/WalletContext"
import { createTransactionProposal } from "@/services/transactions"
import { TransactionType } from "@/core/interfaces"

const transactionFormSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().optional(),
  toAddress: z.string().min(10, { message: "Invalid recipient address" }),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  tokenAddress: z.string().optional(),
  data: z.string().optional(),
  transactionType: z.enum(["transfer", "token_transfer", "contract_interaction"]),
})

type TransactionFormValues = z.infer<typeof transactionFormSchema>

function TransactionProposal({ walletId }: { walletId: string }) {
  const { currentWallet } = useWallet()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      title: "",
      description: "",
      toAddress: "",
      amount: "",
      tokenAddress: "",
      data: "",
      transactionType: "transfer",
    },
  })

  if (!currentWallet) return <div>No wallet selected</div>

  async function onSubmit(values: TransactionFormValues) {
    try {
      setIsSubmitting(true)
      setError(null)
      
      const result = await createTransactionProposal({
        walletId,
        title: values.title,
        description: values.description || "",
        toAddress: values.toAddress,
        amount: values.amount,
        tokenAddress: values.tokenAddress,
        data: values.data,
        transactionType: values.transactionType as TransactionType,
      })
      
      setSuccess(true)
      form.reset()
    } catch (err: any) {
      setError(err.message || "Failed to create transaction proposal")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show advanced fields based on transaction type
  const showTokenField = form.watch("transactionType") === "token_transfer"
  const showDataField = form.watch("transactionType") === "contract_interaction"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Transaction Proposal</CardTitle>
        <CardDescription>
          Create a new transaction proposal for wallet {currentWallet.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-md border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 text-green-800 rounded-md border border-green-200">
            Transaction proposal created successfully!
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Transaction title" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive title for this transaction
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Transaction details" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="transactionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select transaction type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="transfer">Native Token Transfer</SelectItem>
                      <SelectItem value="token_transfer">Token Transfer</SelectItem>
                      <SelectItem value="contract_interaction">Contract Interaction</SelectItem>
                    </SelectContent>
                  </Select>
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
            
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="0.0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {showTokenField && (
              <FormField
                control={form.control}
                name="tokenAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Address</FormLabel>
                    <FormControl>
                      <Input placeholder="0x..." {...field} />
                    </FormControl>
                    <FormDescription>
                      The contract address of the token
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {showDataField && (
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Data</FormLabel>
                    <FormControl>
                      <Textarea placeholder="0x..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Hexadecimal data for contract interaction
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Proposal"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export { TransactionProposal }