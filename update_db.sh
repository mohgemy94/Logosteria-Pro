sed -i '/\/\/ 9. Generic INSERT OR REPLACE INTO/!b;n;c\
      const match = cleanSql.match(/INSERT\\s+OR\\s+REPLACE\\s+INTO\\s+([a-zA-Z0-9_]+)\\s*\\(([^)]+)\\)\\s*VALUES/i);\
      if (match) {\
        const table = match[1].toLowerCase();\
        const columnsStr = match[2];\
        const columns = columnsStr.split(",").map(c => c.trim().toLowerCase());\
        const dataObj: Record<string, any> = {};\
        for (let i = 0; i < columns.length; i++) {\
          dataObj[columns[i]] = params[i];\
        }\
        if (table === "items") {\
           const raw = localStorage.getItem("alpha_warehouse_balances_v2");\
           let items = raw ? JSON.parse(raw) : [];\
           const existingIdx = items.findIndex((i:any) => i.id === dataObj.id);\
           const item = { id: dataObj.id, code: dataObj.code, name: dataObj.name, barcode: dataObj.barcode, category: dataObj.category, unit: dataObj.unit, costPrice: dataObj.cost_price, wholesalePrice: dataObj.wholesale_price, retailPrice: dataObj.retail_price, consumerPrice: dataObj.consumer_price, salePrice: dataObj.sale_price, stock: dataObj.stock, minReorderLevel: dataObj.min_reorder_level, isActive: dataObj.is_active !== 0 };\
           if(existingIdx >= 0) items[existingIdx] = item; else items.unshift(item);\
           localStorage.setItem("alpha_warehouse_balances_v2", JSON.stringify(items));\
           localStorage.setItem("alpha_warehouse_items_v1", JSON.stringify(items));\
           if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-stock-updated"));\
        } else if (table === "customers") {\
           const raw = localStorage.getItem("alpha_customers_v1");\
           let arr = raw ? JSON.parse(raw) : [];\
           const existingIdx = arr.findIndex((i:any) => i.id === dataObj.id);\
           const cust = { id: dataObj.id, code: dataObj.code, name: dataObj.name, phone: dataObj.phone, address: dataObj.address, taxNumber: dataObj.tax_number, openingBalance: dataObj.opening_balance, openingBalanceType: dataObj.opening_balance_type, isActive: dataObj.is_active !== 0 };\
           if(existingIdx >= 0) arr[existingIdx] = cust; else arr.unshift(cust);\
           localStorage.setItem("alpha_customers_v1", JSON.stringify(arr));\
           if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-partner-ledger-updated"));\
        } else if (table === "vendors") {\
           const raw = localStorage.getItem("alpha_vendors_v1");\
           let arr = raw ? JSON.parse(raw) : [];\
           const existingIdx = arr.findIndex((i:any) => i.id === dataObj.id);\
           const cust = { id: dataObj.id, code: dataObj.code, name: dataObj.name, phone: dataObj.phone, address: dataObj.address, taxNumber: dataObj.tax_number, openingBalance: dataObj.opening_balance, openingBalanceType: dataObj.opening_balance_type, isActive: dataObj.is_active !== 0 };\
           if(existingIdx >= 0) arr[existingIdx] = cust; else arr.unshift(cust);\
           localStorage.setItem("alpha_vendors_v1", JSON.stringify(arr));\
           if(typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha-partner-ledger-updated"));\
        }\
      }\
      return { changes: 1 };\
' src/services/DatabaseProvider.ts
