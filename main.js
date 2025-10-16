// Dynamically load common footer
document.addEventListener("DOMContentLoaded", () => {
  fetch("components/footer.html")
    .then(res => res.text())
    .then(data => {
      document.getElementById("footer-container").innerHTML = data;
    });
});
