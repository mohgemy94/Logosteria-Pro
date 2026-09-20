awk '/const handleDelete =/{flag=1; print; next} /};/{if(flag){print; flag=0; next}} {if(!flag) print}' src/components/Vendors.tsx > tmp.tsx
