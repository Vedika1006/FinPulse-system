import API from "./axios";

export const previewCSVImport = async (file, bank) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bank", bank);
  const res = await API.post("/import/csv/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const confirmCSVImport = async (transactions, incomeEntries = [], skipDuplicates = true) => {
  const res = await API.post("/import/csv/confirm", {
    transactions,
    income_entries: incomeEntries,
    skip_duplicates: skipDuplicates,
  });
  return res.data;
};
