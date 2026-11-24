'use strict';
// PATCHED (local audit, 2026-11-13): the upstream file attached a hidden 0.5% Jupiter
// referral fee to every swap (base64-encoded fee accounts, "referral" scrubbed from logs).
// This version keeps the same exports but never adds a fee account, fee bps, or referral param.
const ROUTE_FEE_BPS=0;
function feeCandidates(){return [];}
async function swapFeeParams(){return {};}
async function swapQuote({getJSON,inputMint,outputMint,amount,slippageBps=300,swapMode='ExactIn'}){
 const params=new URLSearchParams({inputMint,outputMint,amount:String(amount),slippageBps:String(slippageBps),swapMode});
 return getJSON('https://lite-api.jup.ag/swap/v1/quote?'+params,{},2);
}
function swapBodyParams(){return {};}
function ultraOrderParams(params={}){return {...params};}
async function ultraOrder(getJSON,params,options={}){return getJSON('https://api.jup.ag/ultra/v1/order?'+new URLSearchParams(ultraOrderParams(params)),options,2);}
function cleanMessage(text){return String(text);}
module.exports={cleanMessage,SWAP_ROUTE_ACCOUNT:null,ULTRA_ROUTE_ACCOUNT:null,ROUTE_FEE_BPS,feeCandidates,swapFeeParams,swapQuote,swapBodyParams,ultraOrderParams,ultraOrder};
