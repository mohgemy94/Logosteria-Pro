sed -i '/return { changes: 0 };/i\
    const delMatch = cleanSql.match(/DELETE\\s+FROM\\s+([a-zA-Z0-9_]+)\\s+WHERE\\s+id\\s*=\\s*\\?/i);\
    if (delMatch) {\
      const table = delMatch[1].toLowerCase();\
      const [id] = params;\
      if (table === "items") {\
         const raw = localStorage.getItem("alpha_warehouse_balances_v2");\
         let items = raw ? JSON.parse(raw) : [];\
         items = items.filter((i:any) => i.id !== id);\
         localStorage.setItem("alpha_warehouse_balances_v2", JSON.stringify(items));\
         localStorage.setItem("alpha_warehouse_items_v1", JSON.stringify(items));\
         if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-stock-updated"));\
      } else if (table === "customers") {\
         const raw = localStorage.getItem("alpha_customers_v1");\
         let arr = raw ? JSON.parse(raw) : [];\
         arr = arr.filter((i:any) => i.id !== id);\
         localStorage.setItem("alpha_customers_v1", JSON.stringify(arr));\
         if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-partner-ledger-updated"));\
      } else if (table === "vendors") {\
         const raw = localStorage.getItem("alpha_vendors_v1");\
         let arr = raw ? JSON.parse(raw) : [];\
         arr = arr.filter((i:any) => i.id !== id);\
         localStorage.setItem("alpha_vendors_v1", JSON.stringify(arr));\
         if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-partner-ledger-updated"));\
      }\
      return { changes: 1 };\
    }\
' src/services/DatabaseProvider.ts
