import { encodeFunctionData, erc20Abi, getAddress, type Hex } from "viem"

/**
 * ERC-20 `transfer(to, amount)` calldata for a sponsored Turnkey transaction.
 * The transaction's `to` is the token contract, `value` is "0", and the returned
 * bytes are the `data`. `amountAtomic` is in the token's base units.
 */
export const buildErc20TransferData = (
  to: string,
  amountAtomic: bigint
): Hex =>
  encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [getAddress(to), amountAtomic],
  })
